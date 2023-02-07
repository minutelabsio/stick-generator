import{$ as f}from"./index-5bd3dcd0.js";import{h as y,i as c,g as n,f as h,b as m,e as w,s as A,r as I}from"./index-29800c50.js";import{a as v}from"./notifications-4ae7a520.js";import{f as S}from"./utils-a870ce58.js";const $=y("private","settings"),r=c($,y("avatars")),b=c(r,y("archive")),p="avatar",D=20,k=async()=>{const t=f(h);if(!await t.exists(r))return;const i=await t.ls(r),s=Object.keys(i).find(e=>e.includes(p)),o=s.split(".")[0],l=`${o[0]}-${Date.now()}.${o[1]}`,d=c(r,m(s)),u=c(b,m(l));await t.mv(d,u),await t.publish()},x=async()=>{try{n.update(e=>({...e,loading:!0}));const t=f(h);if(!await t.exists(r)){n.update(e=>({...e,loading:!1}));return}const i=await t.ls(r),s=Object.keys(i).find(e=>e.includes(p));if(!s){n.update(e=>({...e,loading:!1}));return}const o=await t.get(c(r,m(`${s}`))),l=o.header.content.toString(),d=`data:image/jpeg;base64, ${w(o.content,"base64")}`,u={cid:l,ctime:o.header.metadata.unixMeta.ctime,name:s,src:d};n.update(e=>({...e,avatar:u,loading:!1}))}catch(t){console.error(t),n.update(a=>({...a,avatar:null,loading:!1}))}},F=async t=>{try{n.update(o=>({...o,loading:!0}));const a=f(h);if(t.size/(1024*1024)>D)throw new Error("Image can be no larger than 20MB");await k();const s=new File([t],`${p}.${t.name.split(".")[1]}`,{type:t.type});await a.write(c(r,m(s.name)),await S(s)),await a.publish(),v("Your avatar has been updated!","success")}catch(a){v(a.message,"error"),console.error(a)}},L=async()=>{const{program:{components:{crypto:t,reference:a}},username:{full:i,hashed:s,trimmed:o}}=f(A),l=await a.didRoot.lookup(s),d=await I({crypto:t,accountDID:l}),u=w(d,"base64pad"),e={weekday:"short",year:"numeric",month:"short",day:"numeric"},g=new Date;return`#     %@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%
#   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
# %@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%
# @@@@@%     %@@@@@@%         %@@@@@@@%     %@@@@@
# @@@@@       @@@@@%            @@@@@@       @@@@@
# @@@@@%      @@@@@             %@@@@@      %@@@@@
# @@@@@@%     @@@@@     %@@%     @@@@@     %@@@@@@
# @@@@@@@     @@@@@    %@@@@%    @@@@@     @@@@@@@
# @@@@@@@     @@@@%    @@@@@@    @@@@@     @@@@@@@
# @@@@@@@    %@@@@     @@@@@@    @@@@@%    @@@@@@@
# @@@@@@@    @@@@@     @@@@@@    %@@@@@    @@@@@@@
# @@@@@@@    @@@@@@@@@@@@@@@@     @@@@@    @@@@@@@
# @@@@@@@    %@@@@@@@@@@@@@@@     @@@@%    @@@@@@@
# @@@@@@@     %@@%     @@@@@@     %@@%     @@@@@@@
# @@@@@@@              @@@@@@              @@@@@@@
# @@@@@@@%            %@@@@@@%            %@@@@@@@
# @@@@@@@@@%        %@@@@@@@@@@%        %@@@@@@@@@
# %@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%
#   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
#     %@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%
#
# This is your recovery kit. (It’s a yaml text file)
#
# Created for ${o} on ${g.toLocaleDateString("en-US",e)}
#
# Store this somewhere safe.
#
# Anyone with this file will have read access to your private files.
# Losing it means you won’t be able to recover your account
# in case you lose access to all your linked devices.
#
# Our team will never ask you to share this file.
#
# To use this file, go to ${window.location.origin}/recover/
# Learn how to customize this kit for your users: https://guide.fission.codes/

username: ${i}
key: ${u}`};export{$ as A,L as a,x as g,F as u};
