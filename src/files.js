/* ---------- PHOTO COMPRESSION (target 200–300 KB) ---------- */
async function compressImage(file){
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Не вдалося прочитати фото'));i.src=url});
  let max=1600,q=.82,blob=null;
  for(let k=0;k<8;k++){
   const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);
   blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));
   if(blob.size<=300*1024)break;
   if(q>.6)q-=.08;else max=Math.round(max*.8);
  }
  if(file.size<=blob.size&&file.size<=300*1024&&/^image\/(jpeg|png|webp)$/.test(file.type))return file;
  return blob;
 }finally{URL.revokeObjectURL(url)}
}

/* activity files (.fit/.gpx/.tcx): see import.js */
