import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../lib/api';
import { colors, radius, shadow } from '../constants/theme';

const DOCUMENT_TYPES = [
  { id: 'GHANA_CARD_FRONT',       label: 'Ghana Card – Front',                   required: true  },
  { id: 'GHANA_CARD_BACK',        label: 'Ghana Card – Back',                    required: true  },
  { id: 'BUSINESS_REGISTRATION',  label: 'Business Registration Certificate',    required: true  },
  { id: 'TIN',                    label: 'TIN Certificate',                      required: false },
  { id: 'BUSINESS_PERMIT',        label: 'Business Operating Permit',            required: false },
];

const STATUS_CONFIG = {
  PENDING:  { color: colors.warning, icon: 'time-outline',             label: 'Pending Review' },
  APPROVED: { color: colors.success, icon: 'checkmark-circle-outline', label: 'Approved' },
  REJECTED: { color: colors.danger,  icon: 'close-circle-outline',     label: 'Rejected' },
};

export default function BusinessDocumentsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [documents, setDocuments]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading]   = useState({});

  const fetchDocuments = useCallback(async () => {
    try {
      const { data } = await api.get('/business/documents');
      setDocuments(data);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchDocuments(); }, []);

  function getDoc(typeId) {
    return documents.find(d => d.type === typeId);
  }

  async function uploadDocument(typeId) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('File too large', 'Maximum file size is 5 MB.');
      return;
    }

    setUploading(u => ({ ...u, [typeId]: true }));
    try {
      const formData = new FormData();
      formData.append('type', typeId);
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName || `${typeId.toLowerCase()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
      const { data } = await api.post('/business/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocuments(docs => {
        const others = docs.filter(d => d.type !== typeId);
        return [...others, data];
      });
      Alert.alert('Uploaded', 'Document submitted for review.');
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.error || 'Could not upload document.');
    } finally {
      setUploading(u => ({ ...u, [typeId]: false }));
    }
  }

  const approved = documents.filter(d => d.status === 'APPROVED').length;
  const required = DOCUMENT_TYPES.filter(t => t.required).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KYC Documents</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDocuments(); }} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
        >
          {/* Progress */}
          <View style={styles.progressCard}>
            <Text style={styles.progressText}>
              {approved} of {required} required documents approved
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(approved / required) * 100}%` }]} />
            </View>
          </View>

          <Text style={styles.infoText}>
            Upload JPG, PNG or PDF files. Maximum 5 MB per document. Required documents are marked with *.
          </Text>

          {DOCUMENT_TYPES.map(docType => {
            const doc  = getDoc(docType.id);
            const cfg  = doc ? (STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.PENDING) : null;
            const busy = uploading[docType.id];

            return (
              <View key={docType.id} style={styles.docCard}>
                <View style={styles.docHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docLabel}>
                      {docType.label}{docType.required ? ' *' : ''}
                    </Text>
                    {doc ? (
                      <View style={styles.docStatusRow}>
                        <Ionicons name={cfg.icon} size={13} color={cfg.color} />
                        <Text style={[styles.docStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    ) : (
                      <Text style={styles.docNotUploaded}>Not uploaded</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => uploadDocument(docType.id)}
                    disabled={busy || doc?.status === 'APPROVED'}
                    style={[
                      styles.uploadBtn,
                      doc?.status === 'APPROVED' && styles.uploadBtnDone,
                      busy && { opacity: 0.6 },
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <>
                        <Ionicons
                          name={doc?.status === 'APPROVED' ? 'checkmark' : 'cloud-upload-outline'}
                          size={16}
                          color={colors.white}
                        />
                        <Text style={styles.uploadBtnText}>
                          {doc?.status === 'APPROVED' ? 'Approved' : doc ? 'Re-upload' : 'Upload'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {doc?.status === 'REJECTED' && doc.reviewNotes && (
                  <View style={styles.rejectionNote}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.danger} />
                    <Text style={styles.rejectionText}>{doc.reviewNotes}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

  progressCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10,
  },
  progressText: { fontSize: 14, fontWeight: '700', color: colors.text },
  progressBar:  { height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },

  infoText: { fontSize: 12, color: colors.muted, lineHeight: 18 },

  docCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 14, ...shadow.sm,
  },
  docHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docLabel:      { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  docStatusRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  docStatusText: { fontSize: 12, fontWeight: '600' },
  docNotUploaded: { fontSize: 12, color: colors.muted },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  uploadBtnDone: { backgroundColor: colors.success },
  uploadBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },

  rejectionNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 10, backgroundColor: colors.danger + '12',
    borderRadius: radius.sm, padding: 8,
  },
  rejectionText: { flex: 1, fontSize: 12, color: colors.danger, lineHeight: 17 },
});
