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
  const roundRect=(ctx,x,y,w,h,r,fill,stroke)=>{
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);
    if(fill){ctx.fillStyle=fill;ctx.fill()}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}
  };
  const loadImage=src=>new Promise((resolve,reject)=>{
    const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=reject;im.src=src
  });
  const drawContainDark=(ctx,img,x,y,w,h,r=18)=>{
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();
    ctx.fillStyle='#0d1116';ctx.fillRect(x,y,w,h);
    const pad=8,scale=Math.min((w-pad*2)/img.width,(h-pad*2)/img.height);
    const dw=img.width*scale,dh=img.height*scale;
    ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);ctx.restore();
  };
  const fitText=(ctx,text,maxWidth,maxLines)=>{
    const words=String(text||'').split(/\s+/);const lines=[];let line='';
    for(const word of words){
      const test=line?line+' '+word:word;
      if(ctx.measureText(test).width<=maxWidth)line=test;
      else{if(line)lines.push(line);line=word;if(lines.length===maxLines-1)break}
    }
    if(line&&lines.length<maxLines)lines.push(line);
    const used=lines.join(' ').split(/\s+/).length;
    if(lines.length===maxLines&&used<words.length){
      let last=lines[maxLines-1];
      while(last&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);
      lines[maxLines-1]=last+'…'
    }
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

  function collectRows(product){
    const rows=[];
    if((product.colors||[]).length)rows.push(['اللون',colorsText(product.colors)]);
    if((product.sizes||[]).length)rows.push(['المقاسات',(product.sizes||[]).join(' · ')]);
    else if(product.dimensions)rows.push(['الأبعاد',localizeOne(product.dimensions)]);
    const specs=Object.entries(product.keySpecs||{}).filter(([,v])=>v!=null&&v!==''&&v!==false);
    for(const [k,v] of specs){
      const label=SPEC_LABELS[k]||k,val=valueText(v);
      if(!rows.some(r=>r[0]===label&&r[1]===val))rows.push([label,val])
    }
    return rows.slice(0,8);
  }

  async function build(product,proxy){
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#090c10';ctx.fillRect(0,0,W,H);
    ctx.textAlign='right';ctx.direction='rtl';

    const mainUrl=product.cardMainImage||(product.cardImages||[])[0]||(product.images||[])[0];
    const galleryUrls=(product.cardGalleryImages?.length?product.cardGalleryImages:
      (product.cardImages?.length?product.cardImages.slice(1):(product.images||[]).slice(1,7)))
      .filter(Boolean).filter(u=>u!==mainUrl).slice(0,6);

    let mainImg=null;
    try{if(mainUrl)mainImg=await loadImage(proxy(mainUrl))}catch{}
    const gallery=[];
    for(const u of galleryUrls){try{gallery.push(await loadImage(proxy(u)))}catch{}}

    const topY=105,topH=975,mainMaxW=720,gap=38,leftX=50;
    let mainW=620,mainH=topH,mainY=topY;
    if(mainImg){
      const scale=Math.min(mainMaxW/mainImg.width,topH/mainImg.height);
      mainW=mainImg.width*scale;mainH=mainImg.height*scale;
      mainY=topY+(topH-mainH)/2;
      ctx.save();ctx.beginPath();ctx.roundRect(leftX,mainY,mainW,mainH,28);ctx.clip();
      ctx.drawImage(mainImg,leftX,mainY,mainW,mainH);ctx.restore();
    }else{
      roundRect(ctx,leftX,topY,620,topH,28,'#10151b','#29313a');
    }

    const infoX=leftX+mainW+gap,infoRight=1390,infoW=Math.max(430,infoRight-infoX);
    ctx.fillStyle='#d6a84b';ctx.font='700 24px Arial';ctx.fillText('GACELA GALLERY',infoRight,topY+8);
    ctx.fillStyle='#707984';ctx.font='500 16px Arial';ctx.fillText('معلومات المنتج',infoRight,topY+36);

    let cy=topY+105;
    ctx.fillStyle='#f5f1e8';ctx.font='700 39px Arial';
    const titleLines=fitText(ctx,product.name||'',infoW,3);
    titleLines.forEach((l,i)=>ctx.fillText(l,infoRight,cy+i*49));
    cy+=titleLines.length*49+14;

    ctx.fillStyle='#4fce91';ctx.font='800 43px Arial';
    ctx.fillText(product.price?`${product.price} ${product.currency||'TRY'}`:'',infoRight,cy);
    cy+=62;

    const rows=collectRows(product),rowGap=12;
    const available=Math.max(330,topY+topH-cy-10);
    const rowH=Math.min(82,Math.max(60,(available-rowGap*Math.max(0,rows.length-1))/Math.max(1,rows.length)));
    for(const [label,val] of rows){
      roundRect(ctx,infoX,cy-31,infoW,rowH,16,'#11161c','#29313a');
      ctx.fillStyle='#d6a84b';ctx.font='700 21px Arial';ctx.textAlign='right';ctx.direction='rtl';
      ctx.fillText(label,infoRight-18,cy+6);
      ctx.fillStyle='#f5f1e8';ctx.font='600 21px Arial';ctx.textAlign='left';ctx.direction='rtl';
      let t=String(val);
      while(t.length>5&&ctx.measureText(t).width>infoW-155)t=t.slice(0,-2);
      if(t!==String(val))t+='…';
      ctx.fillText(t,infoX+18,cy+6);
      cy+=rowH+rowGap;
      if(cy>topY+topH-15)break;
    }

    const galleryY=1130,galleryBottom=1718,galleryH=galleryBottom-galleryY;
    if(gallery.length){
      const n=gallery.length;
      const rowsCount=n<=4?1:2;
      const cols=rowsCount===1?n:Math.ceil(n/2);
      const gx=50,gw=1340,cellGap=16;
      const rowH2=(galleryH-cellGap*(rowsCount-1))/rowsCount;
      const cellW=(gw-cellGap*(cols-1))/cols;
      gallery.forEach((img,i)=>{
        const row=rowsCount===1?0:Math.floor(i/cols);
        const col=rowsCount===1?i:i%cols;
        const x=gx+col*(cellW+cellGap),y=galleryY+row*(rowH2+cellGap);
        drawContainDark(ctx,img,x,y,cellW,rowH2,20);
      });
    }else{
      ctx.strokeStyle='#252c33';ctx.beginPath();ctx.moveTo(50,galleryY);ctx.lineTo(1390,galleryY);ctx.stroke();
    }

    ctx.strokeStyle='#252c33';ctx.beginPath();ctx.moveTo(50,1750);ctx.lineTo(1390,1750);ctx.stroke();
    ctx.fillStyle='#626b74';ctx.font='500 17px Arial';ctx.textAlign='right';ctx.direction='rtl';
    ctx.fillText('GACELA GALLERY',1375,1781);
    return canvas;
  }

  const blobFrom=canvas=>new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.96));
  async function preview(product,proxy,imgEl){
    const canvas=await build(product,proxy);imgEl.src=canvas.toDataURL('image/png');imgEl.style.display='block';return canvas
  }
  async function download(product,proxy){
    const canvas=await build(product,proxy),blob=await blobFrom(canvas);
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gacela-product-card.png';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)
  }
  async function share(product,proxy){
    const canvas=await build(product,proxy),blob=await blobFrom(canvas),
      file=new File([blob],'gacela-product-card.png',{type:'image/png'});
    if(navigator.canShare?.({files:[file]})&&navigator.share){
      await navigator.share({files:[file],title:product.name||'Gacela Gallery'});return true
    }
    await download(product,proxy);return false
  }
  window.TrendyCard={build,preview,download,share};
})();