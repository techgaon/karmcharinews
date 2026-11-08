// Discovery hints choose scan priorities; they never establish an article's geography.
export const ruralTerms = ['पंचायत','ग्राम सभा','ग्रामसभा','ग्राम प्रधान','मनरेगा','ग्राम विकास','पंचायती राज','ग्राम निधि','पंचायत भवन','सामुदायिक शौचालय','स्वच्छ भारत','अमृत सरोवर','ग्राम्य विकास','आवास योजना','विकास खंड','खंड विकास','रोजगार सेवक','पंचायत सहायक','जल जीवन मिशन'];
export function districtFeeds(cfg){
  const groups=[['पंचायत OR ग्रामसभा OR "ग्राम सभा" OR प्रधान OR सचिव OR "पंचायत सहायक"','panchayat'],['मनरेगा OR "ग्राम विकास" OR "ग्राम्य विकास" OR "आवास योजना" OR शौचालय OR "अमृत सरोवर" OR "जल जीवन मिशन" OR "विकास खंड"','development']];
  return cfg.districtsHi.flatMap((name,i)=>groups.map(([terms,topic])=>({name:`UP ${cfg.upDistricts[i]}: ${topic}`,district:cfg.upDistricts[i],priority:true,topic,url:'https://news.google.com/rss/search?q='+encodeURIComponent(`"${name}" उत्तर प्रदेश (${terms}) when:7d`)+'&hl=hi&gl=IN&ceid=IN:hi'})));
}
export async function scanFeeds(feeds,read,report,concurrency=6){
  let next=0;const items=[];
  await Promise.all(Array.from({length:Math.min(concurrency,feeds.length)},async()=>{while(next<feeds.length){const f=feeds[next++];try{const rows=await read(f);items.push(...rows);report(f,rows.length,null)}catch(error){report(f,0,error)}}}));return items;
}
export function priorityOrder(items,recent){
  const counts=new Map();for(const n of recent){if(n.state==='UP'&&n.vibhag==='panchayat'&&Date.parse(n.ts)>Date.now()-864e5)counts.set(n.district,(counts.get(n.district)||0)+1)}
  const buckets=new Map(),other=[];
  for(const it of items){if(it.hint?.priority){const k=it.hint.district; if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(it)}else other.push(it)}
  const keys=[...buckets.keys()].sort((a,b)=>(counts.get(a)||0)-(counts.get(b)||0)||a.localeCompare(b));
  const result=[];
  while(keys.some(k=>buckets.get(k).length)){for(const k of keys){const it=buckets.get(k).shift();if(it)result.push(it)}if(other.length)result.push(...other.splice(0,Math.max(1,Math.ceil(keys.length/4))));}
  return result.concat(other);
}
export function differentLocalities(a,b){
  if(a.state&&b.state&&a.state!==b.state)return true;
  const da=a.district||a.hint?.district,db=b.district||b.hint?.district;
  return !!(da&&db&&da!=='All'&&db!=='All'&&da!==db);
}
