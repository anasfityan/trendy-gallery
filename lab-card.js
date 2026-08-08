(() => {
  const W=1440,H=1800;
  const SPEC_LABELS={
    dimensions:'الأبعاد',strapLength:'طول الحزام',material:'الخامة',closure:'الإغلاق',compartments:'عدد الأقسام',
    waterResistant:'مقاوم للماء',heelHeight:'ارتفاع الكعب',heelType:'نوع الكعب',fit:'القالب / القصّة',
    composition:'تركيبة القماش',amount:'الكمية / الحجم',variant:'النوع / الرائحة',shade:'درجة اللون',spf:'الحماية SPF',
    form:'التركيبة',finish:'المظهر',skinType:'نوع البشرة',coverage:'التغطية',sole:'النعل',length:'الطول',
    stretch:'المرونة',compatibility:'التوافق',features:'الميزات',modelSize:'مقاس الموديل'
  };
  const AR={
    Siyah:'أسود',Beyaz:'أبيض',Kırmızı:'أحمر',Kirmizi:'أحمر',Pembe:'وردي',Gri:'رمادي',Bordo:'عنابي',
    Kahve:'بني',Kahverengi:'بني',Mavi:'أزرق',Lacivert:'كحلي',Yeşil:'أخضر',Yesil:'أخضر',Bej:'بيج',
    Krem:'كريمي','Kum rengi':'رملي',Vizon:'فيزون',Sarı:'أصفر',Sari:'أصفر',Mor:'بنفسجي',Turuncu:'برتقالي',
    Saten:'ساتان','Suni Deri':'جلد صناعي','Hakiki Deri':'جلد طبيعي',Deri:'جلد','Bondit Kumaş':'قماش بونديت',
    Pamuk:'قطن',pamuk:'قطن',Cotton:'قطن',Polyester:'بوليستر',Elastan:'إيلاستان',elastan:'إيلاستان',
    Fermuar:'سحاب','MagSafe uyumlu':'متوافق مع MagSafe','Kablosuz şarj destekli':'يدعم الشحن اللاسلكي',Manyetik:'مغناطيسي',
    Likit:'سائل',Mat:'مطفي',Yüksek:'عالية','Tüm Cilt Tipleri':'جميع أنواع البشرة'
  };
  const roundRect=(ctx,x,y,w,h,r,fill,stroke)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}};
  const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=reject;im.src=src});
  const contain=(ctx,img,x,y,w,h,r=24)=>{
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();ctx.fillStyle='#f1efe9';ctx.fillRect(x,y,w,h);
    const pad=Math.max(16,Math.min(w,h)*0.035);
    const scale=Math.min((w-pad*2)/img.width,(h-pad*2)/img.height);
    const dw=img.width*scale,dh=img.height*scale;
    ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);ctx.restore();
  };
  const fitText=(ctx,text,maxWidth,maxLines)=>{
    const words=String(text||'').split(/\s+/);const lines=[];let line='';
    for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=maxWidth)line=test;else{if(line)lines.push(line);line=word;if(lines.length===maxLines-1)break}}
    if(line&&lines.length<maxLines)lines.push(line);
    const used=lines.join(' ').split(/\s+/).length;if(lines.length===maxLines&&used<words.length){let last=lines[maxLines-1];while(last&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);lines[maxLines-1]=last+'…'}
    return lines;
  };
  const localizeOne=v=>{
    let s=String(v??'').trim();if(AR[s])return AR[s];
    s=s.replace(/(\d+)\s*%\s*(pamuk|Pamuk|Cotton)/g,'$1% قطن')
      .replace(/(\d+)\s*%\s*(elastan|Elastan)/g,'$1% إيلاستان')
      .replace(/(\d+)\s*%\s*(polyester|Polyester)/g,'$1% بوليستر')
      .replace(/\bcm\b/gi,'سم');
    return AR[s]||s;
  };
  const valueText=v=>Array.isArray(v)?v.map(localizeOne).join(' · '):(v===true?'نعم':localizeOne(v));
  const colorsText=a=>(a||[]).map(localizeOne).join(' · ');

  async function build(product,proxy){
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#090c10';ctx.fillRect(0,0,W,H);ctx.textAlign='right';ctx.direction='rtl';

    // Quiet brand header.
    ctx.fillStyle='#d6a84b';ctx.font='700 25px Arial';ctx.fillText('GACELA GALLERY',1375,50);
    ctx.fillStyle='#747c85';ctx.font='500 17px Arial';ctx.fillText('معلومات المنتج',1375,79);

    // The selected images are supplied by the lab. Fallback is first four product images.
    const urls=(product.cardImages?.length?product.cardImages:product.images||[]).filter(Boolean).slice(0,4),imgs=[];
    for(const u of urls){try{imgs.push(await loadImage(proxy(u)))}catch{}}

    const x=50,y=105,totalW=1340,totalH=1010,g=18;
    if(imgs.length===1){
      roundRect(ctx,x,y,totalW,totalH,34,'#f1efe9','#282e35');contain(ctx,imgs[0],x,y,totalW,totalH,34);
    }else if(imgs.length===2){
      const mainW=900,sideW=totalW-mainW-g;
      roundRect(ctx,x,y,mainW,totalH,34,'#f1efe9','#282e35');contain(ctx,imgs[0],x,y,mainW,totalH,34);
      roundRect(ctx,x+mainW+g,y,sideW,totalH,30,'#f1efe9','#282e35');contain(ctx,imgs[1],x+mainW+g,y,sideW,totalH,30);
    }else if(imgs.length===3){
      const mainW=900,sideW=totalW-mainW-g,smallH=(totalH-g)/2;
      roundRect(ctx,x,y,mainW,totalH,34,'#f1efe9','#282e35');contain(ctx,imgs[0],x,y,mainW,totalH,34);
      for(let i=1;i<3;i++){const sy=y+(i-1)*(smallH+g);roundRect(ctx,x+mainW+g,sy,sideW,smallH,28,'#f1efe9','#282e35');contain(ctx,imgs[i],x+mainW+g,sy,sideW,smallH,28)}
    }else if(imgs.length>=4){
      const mainW=890,sideW=totalW-mainW-g,smallH=(totalH-g*2)/3;
      roundRect(ctx,x,y,mainW,totalH,34,'#f1efe9','#282e35');contain(ctx,imgs[0],x,y,mainW,totalH,34);
      for(let i=1;i<4;i++){const sy=y+(i-1)*(smallH+g);roundRect(ctx,x+mainW+g,sy,sideW,smallH,26,'#f1efe9','#282e35');contain(ctx,imgs[i],x+mainW+g,sy,sideW,smallH,26)}
    }

    // Title and price stay close to images.
    let cy=1174;
    ctx.fillStyle='#f5f1e8';ctx.font='700 41px Arial';
    const titleLines=fitText(ctx,product.name||'',1340,2);titleLines.forEach((l,i)=>ctx.fillText(l,1375,cy+i*52));
    cy+=titleLines.length*52+8;
    ctx.fillStyle='#4fce91';ctx.font='800 44px Arial';ctx.fillText(product.price?`${product.price} ${product.currency||'TRY'}`:'',1375,cy);cy+=58;

    // Customer-facing facts only.
    const rows=[];
    if((product.colors||[]).length)rows.push(['اللون',colorsText(product.colors)]);
    if((product.sizes||[]).length)rows.push(['المقاسات',(product.sizes||[]).join(' · ')]);
    else if(product.dimensions)rows.push(['الأبعاد',localizeOne(product.dimensions)]);
    const specs=Object.entries(product.keySpecs||{}).filter(([,v])=>v!=null&&v!==''&&v!==false);
    for(const [k,v] of specs){const label=SPEC_LABELS[k]||k,val=valueText(v);if(!rows.some(r=>r[0]===label&&r[1]===val))rows.push([label,val])}

    const rowH=70;for(const [label,val] of rows.slice(0,6)){
      roundRect(ctx,50,cy-36,1340,rowH,17,'#11161c','#29313a');
      ctx.fillStyle='#d6a84b';ctx.font='700 23px Arial';ctx.textAlign='right';ctx.direction='rtl';ctx.fillText(label,1358,cy+6);
      ctx.fillStyle='#f5f1e8';ctx.font='600 23px Arial';ctx.textAlign='left';ctx.direction='rtl';
      let t=String(val);while(t.length>5&&ctx.measureText(t).width>1030)t=t.slice(0,-2);if(t!==String(val))t+='…';ctx.fillText(t,76,cy+6);
      cy+=rowH+9;if(cy>1732)break;
    }

    ctx.strokeStyle='#252c33';ctx.beginPath();ctx.moveTo(50,1750);ctx.lineTo(1390,1750);ctx.stroke();
    ctx.fillStyle='#626b74';ctx.font='500 17px Arial';ctx.textAlign='right';ctx.direction='rtl';ctx.fillText('GACELA GALLERY',1375,1781);
    return canvas;
  }
  const blobFrom=canvas=>new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.96));
  async function preview(product,proxy,imgEl){const canvas=await build(product,proxy);imgEl.src=canvas.toDataURL('image/png');imgEl.style.display='block';return canvas}
  async function download(product,proxy){const canvas=await build(product,proxy),blob=await blobFrom(canvas);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gacela-product-card.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
  async function share(product,proxy){const canvas=await build(product,proxy),blob=await blobFrom(canvas),file=new File([blob],'gacela-product-card.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:product.name||'Gacela Gallery'});return true}await download(product,proxy);return false}
  window.TrendyCard={build,preview,download,share};
})();