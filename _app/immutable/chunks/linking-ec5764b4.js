import{$ as o}from"./index-5bd3dcd0.js";import{s}from"./index-29800c50.js";const i=async t=>{const r=o(s);return r.authStrategy?r.authStrategy.accountConsumer(t):new Promise(e=>{s.subscribe(n=>{if(!n.authStrategy)return;const c=n.authStrategy.accountConsumer(t);e(c)})})},g=async t=>o(s).authStrategy.accountProducer(t);export{i as a,g as c};
