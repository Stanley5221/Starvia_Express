import os, re
root_dir = r'c:\Users\stanl\OneDrive\Desktop\STANLEY\codes\Starvia_Express'
shared_dir = os.path.join(root_dir, 'shared')

def get_rel(fp, mod):
    d = os.path.dirname(fp)
    rp = os.path.relpath(shared_dir, d).replace('\\', '/')
    return f'{rp}/{mod}'

files = [
    r'web\src\pages\TrackOrder.jsx',
    r'web\src\pages\RiderRegister.jsx',
    r'web\src\pages\PlaceOrder.jsx',
    r'web\src\pages\Orders.jsx',
    r'web\src\context\AuthContext.jsx',
    r'apps\admin\src\pages\Customers.jsx',
    r'apps\admin\src\pages\Orders.jsx',
    r'apps\admin\src\pages\Pricing.jsx',
    r'apps\admin\src\pages\Riders.jsx',
    r'apps\admin\src\pages\Dashboard.jsx',
    r'apps\admin\src\context\AuthContext.jsx',
    r'apps\rider\src\screens\HomeScreen.js',
    r'apps\rider\src\screens\DeliveryScreen.js',
    r'apps\rider\src\context\AuthContext.js',
]

for f in files:
    p = os.path.join(root_dir, f)
    with open(p, 'r', encoding='utf-8') as fin:
        c = fin.read()
    
    c = re.sub(r"from\s+['\"](?:\.\./)+lib/api['\"]", f"from '{get_rel(p, 'api')}'", c)
    c = re.sub(r"from\s+['\"](?:\.\./)+lib/socket['\"]", f"from '{get_rel(p, 'socket')}'", c)
    
    with open(p, 'w', encoding='utf-8') as fout:
        fout.write(c)
print('Updated imports successfully!')
