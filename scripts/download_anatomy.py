import json,re,urllib.request,concurrent.futures,pathlib,time
root=pathlib.Path('/tmp/dayly-anatomy');(root/'obj').mkdir(parents=True,exist_ok=True)
cat=json.load(open(pathlib.Path(__file__).resolve().parents[1]/'research/bodyparts3d/catalog.json'))
rules=[('chest',r'pectoralis major'),('deltoids',r'deltoid'),('biceps',r'biceps brachii'),('triceps',r'triceps brachii'),('forearms',r'carpi|digitorum (superficialis|profundus)|pronator|supinator|brachioradialis|extensor digitorum$|extensor indicis|extensor digiti minimi|palmaris longus'),('obliques',r'external oblique'),('traps',r'trapezius'),('erectors',r'iliocostalis (lumborum|thoracis)|longissimus thoracis|spinalis thoracis'),('glutes',r'gluteus maximus'),('quads',r'rectus femoris|vastus'),('hamstrings',r'biceps femoris|semitendinosus|semimembranosus'),('adductors',r'adductor (longus|brevis|magnus|minimus)|gracilis|pectineus'),('calves',r'gastrocnemius|soleus'),('tibialis',r'tibialis anterior')]
items=[]
for e in cat['muscular']:
 n=e['nameEn'].lower();group=next((id for id,pat in rules if re.search(pat,n)),None)
 if group or re.search(r'serratus anterior|sartorius|tensor fasciae|gluteus medius|brachialis$|infraspinatus|teres major|sternocleidomastoid|calcaneal tendon|iliotibial tract',n):items.append(dict(e,muscleId=group or '',kind='muscle'))
for e in cat['skeletal']:
 if re.search(r'(femur|tibia$|fibula$|humerus|ulna$|radius$|patella|clavicle|scapula|hip bone|sternum|rib$|vertebra|sacrum)',e['nameEn'].lower()):items.append(dict(e,muscleId='',kind='bone'))
items.append(dict(id='FJ2810',nameEn='Skin',muscleId='',kind='skin'))
json.dump(items,open(root/'selected.json','w'),indent=2)
def download(e):
 target=root/'obj'/f"{e['id']}.obj"
 if target.exists():return target.stat().st_size
 url=f"https://raw.githubusercontent.com/jixiangying/anatomy/main/isa_BP3D_4.0_obj_99/{e['id']}.obj"
 for attempt in range(3):
  try:
   data=urllib.request.urlopen(url,timeout=35).read();target.write_bytes(data);return len(data)
  except Exception:
   if attempt==2:raise
   time.sleep(1)
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
 total=sum(pool.map(download,items))
print(json.dumps({'files':len(items),'bytes':total,'groups':sorted(set(e['muscleId'] for e in items))}))
