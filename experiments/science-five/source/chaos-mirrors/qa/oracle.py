from pathlib import Path
import json, math, numpy as np
from scipy.integrate import solve_ivp
P=Path(__file__).parent
G=9.81
# Independently derived Lagrange mass matrix for two unit masses/unit rods.
def f(t,s):
    a,b,u,v=s;d=a-b
    accel=np.linalg.solve([[2,math.cos(d)],[math.cos(d),1]],[-v*v*math.sin(d)-2*G*math.sin(a),u*u*math.sin(d)-G*math.sin(b)])
    return [u,v,*accel]
fixtures=[]
for a,b in [(140,160),(115,-103),(10,11)]:
    s=[a*math.pi/180,b*math.pi/180,0,0]
    solution=solve_ivp(f,[0,5],s,method='DOP853',rtol=2.3e-14,atol=2.3e-14,dense_output=False)
    assert solution.success
    fixtures.append({'initial':s,'time':5,'reference':solution.y[:,-1].tolist(),'functionEvaluations':solution.nfev})
res={'method':'SciPy DOP853, independent Lagrange mass matrix','rtol':2.3e-14,'atol':2.3e-14,'fixtures':fixtures}
(P/'oracle.json').write_text(json.dumps(res,indent=2)+'\n')
print(json.dumps(res))
