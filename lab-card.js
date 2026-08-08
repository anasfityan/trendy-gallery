(() => {
  const W=1440,H=1800;
  const M=44,R=28;
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
  const rr=(ctx,x,y,w,h,r,fill,stroke,lw=2)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}};
  const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=reject;im.src=src});
  const fitText=(ctx,text,maxWidth,maxLines)=>{const words=String(text||'').split(/\s+/),lines=[];let line='';for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=maxWidth)line=test;else{if(line)lines.push(line);line=word;if(lines.length===maxLines-1)break}}if(line&&lines.length<maxLines)lines.push(line);return lines};
  const localizeOne=v=>{let s=String(v??'').trim();if(AR[s])return AR[s];s=s.replace(/(\d+)\s*%\s*(pamuk|Pamuk|Cotton)/g,'$1% قطن').replace(/(\d+)\s*%\s*(elastan|Elastan)/g,'$1% إيلاستان').replace(/(\d+)\s*%\s*(polyester|Polyester)/g,'$1% بوليستر').replace(/\bcm\b/gi,'سم');return AR[s]||s};
  const valueText=v=>Array.isArray(v)?v.map(localizeOne).join(' · '):(v===true?'نعم':localizeOne(v));
  const colorsText=a=>(a||[]).map(localizeOne).join(' · ');
  const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  function cleanProductTitle(product){
    let title=String(product.name||'').replace(/\s*\|\s*[^|]+$/,'').trim();
    const colors=[...(product.colors||[])].filter(Boolean).sort((a,b)=>String(b).length-String(a).length);
    for(const color of colors){
      const rx=new RegExp(`(?:\\s*[-–—|/]?\\s*)${esc(color)}\\s*$`,'i');
      title=title.replace(rx,'').trim();
    }
    return title;
  }

  function collectRows(product){
    const rows=[];
    if((product.colors||[]).length)rows.push(['اللون',colorsText(product.colors)]);
    if((product.sizes||[]).length)rows.push(['المقاسات',(product.sizes||[]).join(' · ')]);
    else if(product.dimensions)rows.push(['الأبعاد',localizeOne(product.dimensions)]);
    for(const [k,v] of Object.entries(product.keySpecs||{}).filter(([,v])=>v!=null&&v!==''&&v!==false)){
      const label=SPEC_LABELS[k]||k,val=valueText(v);
      if(!rows.some(r=>r[0]===label&&r[1]===val))rows.push([label,val]);
    }
    return rows.slice(0,6);
  }

  function drawBrand(ctx,right,y){
    ctx.save();
    ctx.direction='ltr';ctx.textAlign='left';ctx.textBaseline='alphabetic';
    const parts=[
      {t:'G',font:'600 35px Georgia',c:'#d6a84b'},
      {t:'acela',font:'500 25px Georgia',c:'#d6a84b'},
      {t:'  ',font:'500 22px Georgia',c:'#ffffff'},
      {t:'G',font:'600 35px Georgia',c:'#f7f4ed'},
      {t:'allery',font:'500 25px Georgia',c:'#f7f4ed'}
    ];
    let total=0;
    for(const p of parts){ctx.font=p.font;total+=ctx.measureText(p.t).width}
    let x=right-total;
    for(const p of parts){ctx.font=p.font;ctx.fillStyle=p.c;ctx.fillText(p.t,x,y);x+=ctx.measureText(p.t).width}
    ctx.restore();
  }

  function drawMain(ctx,img,x,y,w,h){
    rr(ctx,x,y,w,h,22,'#f1f0ed',null);
    if(!img)return;
    const s=Math.min(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;
    const dx=x+(w-dw)/2,dy=y+(h-dh)/2;
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,22);ctx.clip();ctx.drawImage(img,dx,dy,dw,dh);ctx.restore();
  }

  function drawCover(ctx,img,x,y,w,h){
    const ir=img.width/img.height,br=w/h;let sx=0,sy=0,sw=img.width,sh=img.height;
    if(ir>br){sw=img.height*br;sx=(img.width-sw)/2}else{sh=img.width/br;sy=(img.height-sh)/2}
    ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);
  }

  function drawPhotoCard(ctx,img,x,y,w,h,r=18){
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,.26)';ctx.shadowBlur=16;ctx.shadowOffsetY=5;
    rr(ctx,x,y,w,h,r,'#121820','#303943',1.25);
    ctx.restore();
    ctx.save();ctx.beginPath();ctx.roundRect(x+2,y+2,w-4,h-4,r-2);ctx.clip();
    drawCover(ctx,img,x+2,y+2,w-4,h-4);
    ctx.restore();
  }

  function drawGalleryCards(ctx,imgs,x,y,w,h){
    if(!imgs.length)return;
    rr(ctx,x,y,w,h,24,'#0e1319','#242d36',1.4);
    const pad=14,gap=12,innerX=x+pad,innerY=y+pad,innerW=w-pad*2,innerH=h-pad*2;
    const n=Math.min(imgs.length,6),rows=n<=3?1:2,cols=rows===1?n:Math.ceil(n/2);
    const cellW=(innerW-gap*(cols-1))/cols,cellH=(innerH-gap*(rows-1))/rows;
    imgs.slice(0,n).forEach((img,i)=>{
      const row=rows===1?0:Math.floor(i/cols),col=rows===1?i:i%cols;
      drawPhotoCard(ctx,img,innerX+col*(cellW+gap),innerY+row*(cellH+gap),cellW,cellH,18);
    });
  }

  async function build(product,proxy){
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#090c10';ctx.fillRect(0,0,W,H);ctx.textAlign='right';ctx.direction='rtl';

    const mainUrl=product.cardMainImage||(product.cardImages||[])[0]||(product.images||[])[0];
    const galleryUrls=(product.cardGalleryImages?.length?product.cardGalleryImages:(product.cardImages?.length?product.cardImages.slice(1):(product.images||[]).slice(1,7))).filter(Boolean).filter(u=>u!==mainUrl).slice(0,6);
    let mainImg=null;try{if(mainUrl)mainImg=await loadImage(proxy(mainUrl))}catch{}
    const gallery=[];for(const u of galleryUrls){try{gallery.push(await loadImage(proxy(u)))}catch{}}

    const topX=M,topY=62,topW=W-M*2,topH=1060;
    rr(ctx,topX,topY,topW,topH,R,'#0d1116','#202832',1.5);

    const pad=22,innerY=topY+pad,innerH=topH-pad*2;
    const mainW=620,gap=28,mainX=topX+pad,infoX=mainX+mainW+gap,infoW=topX+topW-pad-infoX;
    drawMain(ctx,mainImg,mainX,innerY,mainW,innerH);

    const right=topX+topW-pad;
    drawBrand(ctx,right,innerY+30);
    ctx.fillStyle='#717a84';ctx.font='500 15px Arial';ctx.textAlign='right';ctx.direction='rtl';ctx.fillText('معلومات المنتج',right,innerY+57);

    let cy=innerY+118;
    ctx.fillStyle='#f5f1e8';ctx.font='700 36px Arial';
    const title=fitText(ctx,cleanProductTitle(product),infoW,3);title.forEach((l,i)=>ctx.fillText(l,right,cy+i*46));
    cy+=title.length*46+10;
    ctx.fillStyle='#4fce91';ctx.font='800 42px Arial';ctx.fillText(product.price?`${product.price} ${product.currency||'TRY'}`:'',right,cy);
    cy+=64;

    const rows=collectRows(product),rowGap=12;
    const bottom=innerY+innerH;
    const remaining=Math.max(0,bottom-cy);
    const rowH=rows.length?Math.min(82,Math.max(62,(remaining-rowGap*(rows.length-1))/rows.length)):0;
    for(const [label,val] of rows){
      rr(ctx,infoX,cy,infoW,rowH,15,'#121820','#2a333d',1.5);
      ctx.fillStyle='#d6a84b';ctx.font='700 20px Arial';ctx.textAlign='right';ctx.direction='rtl';ctx.fillText(label,right-17,cy+rowH/2+7);
      ctx.fillStyle='#f5f1e8';ctx.font='600 20px Arial';ctx.textAlign='left';ctx.direction='rtl';
      let t=String(val);while(t.length>5&&ctx.measureText(t).width>infoW-165)t=t.slice(0,-2);if(t!==String(val))t+='…';
      ctx.fillText(t,infoX+17,cy+rowH/2+7);
      cy+=rowH+rowGap;
    }

    const galleryY=topY+topH+24,galleryH=500;
    drawGalleryCards(ctx,gallery,M,galleryY,W-M*2,galleryH);

    const footerY=galleryY+galleryH+28;
    ctx.strokeStyle='#202832';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(M,footerY);ctx.lineTo(W-M,footerY);ctx.stroke();
    drawBrand(ctx,W-M,footerY+40);
    return canvas;
  }

  const blobFrom=canvas=>new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.96));
  async function preview(product,proxy,imgEl){const canvas=await build(product,proxy);imgEl.src=canvas.toDataURL('image/png');imgEl.style.display='block';return canvas}
  async function download(product,proxy){const canvas=await build(product,proxy),blob=await blobFrom(canvas);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gacela-product-card.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
  async function share(product,proxy){const canvas=await build(product,proxy),blob=await blobFrom(canvas),file=new File([blob],'gacela-product-card.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:product.name||'Gacela Gallery'});return true}await download(product,proxy);return false}
  window.TrendyCard={build,preview,download,share};
})();