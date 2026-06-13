const router = require('express').Router();

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY || '';

// GET /api/v1/places/autocomplete?q=ejisu
router.get('/autocomplete', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json([]);

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&language=en&key=${GOOGLE_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[places] autocomplete error:', data.status, data.error_message);
      return res.json([]);
    }

    const predictions = (data.predictions || []).map(p => ({
      place_id: p.place_id,
      main: p.structured_formatting?.main_text || p.description,
      sub:  p.structured_formatting?.secondary_text || '',
    }));

    res.json(predictions);
  } catch (err) { next(err); }
});

// GET /api/v1/places/details?place_id=ChIJ...
router.get('/details', async (req, res, next) => {
  try {
    const { place_id } = req.query;
    if (!place_id) return res.status(400).json({ error: 'place_id required' });

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry,formatted_address&key=${GOOGLE_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('[places] details error:', data.status);
      return res.status(404).json({ error: 'Place not found' });
    }

    const loc = data.result.geometry.location;
    res.json({
      lat:     loc.lat,
      lng:     loc.lng,
      address: data.result.formatted_address,
    });
  } catch (err) { next(err); }
});

// GET /api/v1/places/reverse?lat=6.68&lng=-1.62
router.get('/reverse', async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.results?.length) return res.json({ address: null });

    res.json({ address: data.results[0].formatted_address });
  } catch (err) { next(err); }
});

module.exports = router;
