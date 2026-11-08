const key=x=>String(x||'').normalize('NFD').replace(/[\u093c\s._-]/g,'').toLowerCase();
export const departments=['panchayat','shiksha','revenue','police','health','finance','all'];
export const states=['UP','Bihar','MP','Rajasthan','Uttarakhand','National','Other'];
export function normalizeTags(o,cfg){
  const stateAliases={uttarpradesh:'UP','उत्तरप्रदेश':'UP',madhyapradesh:'MP','मध्यप्रदेश':'MP','बिहार':'Bihar','राजस्थान':'Rajasthan','उत्तराखंड':'Uttarakhand',india:'National','भारत':'National'};
  o.state=states.find(s=>key(s)===key(o.state))||stateAliases[key(o.state)]||stateAliases[key(o.place?.state_en)]||stateAliases[key(o.place?.state_hi)]||'';
  const aliases={panchayatiraj:'panchayat',ruraldevelopment:'panchayat','पंचायतीराज':'panchayat','ग्राम्यविकास':'panchayat',education:'shiksha','शिक्षा':'shiksha'};
  o.vibhag=departments.find(v=>key(v)===key(o.vibhag))||aliases[key(o.vibhag)]||'';
  const raw=o.district||o.place?.district_en||o.place?.district_hi;
  const i=cfg.upDistricts.findIndex((d,i)=>key(d)===key(raw)||key(cfg.districtsHi[i])===key(raw));
  o.district=i>=0?cfg.upDistricts[i]:key(raw)==='all'?'All':'';
  if(!o.state||!o.vibhag||!o.district)return 'Missing or unsupported state/department/district tags';
  if(o.state!=='UP'&&o.district!=='All')return 'UP district conflicts with the reported state';
  return '';
}
export function outputSchema(cfg){
  const str={type:'STRING'},lang={type:'OBJECT',properties:{h:str,s:str},required:['h','s']};
  return {type:'OBJECT',properties:{relevant:{type:'BOOLEAN'},verified:{type:'BOOLEAN'},reason:str,hi:lang,en:lang,aw:lang,bh:lang,vibhag:{type:'STRING',enum:departments},state:{type:'STRING',enum:states},district:{type:'STRING',enum:['All',...cfg.upDistricts]},isGO:{type:'BOOLEAN'},sourceName:str,articleUrl:str,place:{type:'OBJECT',properties:Object.fromEntries(['state','district','block','gp'].flatMap(k=>[[k+'_hi',str],[k+'_en',str]]))}},required:['relevant','verified','hi','en','aw','bh','vibhag','state','district']};
}
