(function(root){
  'use strict';
  const districts=['松山區','信義區','大安區','中山區','中正區','大同區','萬華區','文山區','南港區','內湖區','士林區','北投區'];
  const labels={yes:'已裝設',no:'未裝設',unknown:'待確認',full:'全數裝設',partial:'部分裝設',none:'尚未裝設'};
  const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/台/g,'臺').replace(/[\s()（）·・]/g,'');
  function rows(data){return data.columns.name.map((_,i)=>Object.fromEntries(Object.keys(data.columns).map(k=>[k,data.columns[k][i]])));}
  function stats(rs){const s={total:rs.length,known:0,unknown:0,score:0,bins:[0,0,0,0,0,0],fullAndOutdoor:0,indoorFull:0,outdoorYes:0};rs.forEach(r=>{if(r.indoor==='unknown'||r.outdoor==='unknown')s.unknown++;else{const n={full:4,partial:2,none:0}[r.indoor]+(r.outdoor==='yes'?1:0);s.score+=n;s.known++;s.bins[n]++;}if(r.outdoor==='yes')s.outdoorYes++;if(r.indoor==='full')s.indoorFull++;if(r.outdoor==='yes'&&r.indoor==='full')s.fullAndOutdoor++;});s.index=s.total&&!s.unknown?s.score/(5*s.total)*100:null;s.originalIndex=s.index===null?null:s.index/3;return s;}
  function match(text,q){const a=normalize(text),b=normalize(q);if(!b)return true;if(a.includes(b))return true;let p=0;for(const c of a){if(c===b[p])p++;if(p===b.length)return true;}return false;}
  function filter(rs,f){return rs.filter(r=>(!f.district||f.district==='all'||r.district===f.district)&&(!f.group||f.group==='all'||r.group===f.group)&&(!f.indoor||f.indoor==='all'||r.indoor===f.indoor)&&(!f.outdoor||f.outdoor==='all'||r.outdoor===f.outdoor)&&match(r.name+' '+r.district+' '+r.type,f.q));}
  function validate(d){return !!(d&&d.columns&&['type','district','name','outdoor','indoor','group'].every(k=>Array.isArray(d.columns[k])&&d.columns[k].length===d.columns.name.length)&&d.columns.name.length<=1000&&Array.isArray(d.groups)&&d.columns.outdoor.every(x=>['yes','no','unknown'].includes(x))&&d.columns.indoor.every(x=>['full','partial','none','unknown'].includes(x))&&d.columns.name.every(x=>typeof x==='string')&&d.groups.every(g=>typeof g.id==='string'&&typeof g.label==='string')); }
  function percent(n){return n==null?'—':n.toFixed(1)+'%';}
  root.CameraData={districts,labels,normalize,rows,stats,filter,validate,percent};
  if(typeof module!=='undefined')module.exports=root.CameraData;
})(typeof window!=='undefined'?window:globalThis);
