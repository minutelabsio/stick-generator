import{n}from"./index-29800c50.js";const c=o=>{n.update(i=>i.filter(t=>t.id!==o))},s=(o,i="info",t=5e3)=>{const e=crypto.randomUUID();n.update(a=>[...a,{id:e,msg:o,type:i,timeout:t}]);const r=setTimeout(()=>{c(e),clearTimeout(r)},t);return e};export{s as a};
