(() => {
  const W=1080,H=1350;
  const SPEC_LABELS={
    dimensions:'الأبعاد',strapLength:'طول الحزام',material:'الخامة',closure:'الإغلاق',compartments:'عدد الأقسام',
    waterResistant:'مقاومة الماء',heelHeight:'ارتفاع الكعب',heelType:'نوع الكعب',fit:'القالب / القصّة',
    composition:'تركيبة القماش',amount:'الكمية / الحجم',variant:'النوع / الرائحة',shade:'درجة اللون',spf:'SPF',
    form:'التركيبة',finish:'المظهر',skinType:'نوع البشرة',coverage:'التغطية',sole:'النعل',length:'الطول',
    stretch:'المرونة',compatibility:'التوافق',features:'الميزات',modelSize:'مقاس الموديل'
  };
  const CAT={bags:'حقائب',shoes:'أحذية',clothes:'ملابس',acc:'إكسسوارات',cosmetics:'عناية / تجميل',other:'منتج'};

  const roundRect=(ctx,x,y,w,h,r,fill,stroke)=>{
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}
  };
  const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=reject;im.src=src});
  const cover=(ctx,img,x,y,w,h,r=22)=>{
    const ir=img.width/img.height,br=w/h;let sx=0,sy=0,sw=img.width,sh=img.height;
    if(ir>br){sw=img.height*br;sx=(img.width-sw)/2}else{sh=img.width/br;sy=(img.height-sh)/2}
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);ctx.restore();
  };
  const fitText=(ctx,text,maxWidth,maxLines,lineHeight)=>{
    const words=String(text||'').split(/\s+/);const lines=[];let line='';
    for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=maxWidth)line=test;else{if(line)lines.push(line);line=word;if(lines.length===maxLines-1)break}}
    if(line&&lines.length<maxLines)lines.push(line);
    const used=words.slice(0,lines.join(' ').split(/\s+/).length).length;
    if(lines.length===maxLines && used<words.length){let last=lines[maxLines-1];while(last && ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);lines[maxLines-1]=last+'…'}
    return {lines,height:lines.length*lineHeight};
  };
  const valueText=v=>Array.isArray(v)?v.join(' · '):(v===true?'نعم':String(v??''));

  async function build(product,proxy){
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#0b0d10';ctx.fillRect(0,0,W,H);
    const grad=ctx.createLinearGradient(0,0,W,0);grad.addColorStop(0,'#15191f');grad.addColorStop(1,'#0b0d10');ctx.fillStyle=grad;ctx.fillRect(0,0,W,190);
    ctx.textAlign='right';ctx.direction='rtl';
    ctx.fillStyle='#d6a84b';ctx.font='700 24px Arial';ctx.fillText('TRENDY GALLERY',1020,52);
    ctx.fillStyle='#f5f1e8';ctx.font='700 43px Arial';
    const title=fitText(ctx,product.name||'',930,2,56);title.lines.forEach((l,i)=>ctx.fillText(l,1020,105+i*56));
    ctx.fillStyle='#4fce91';ctx.font='800 38px Arial';ctx.fillText(product.price?`${product.price} ${product.currency||'TRY'}`:'',1020,174);

    const urls=(product.images||[]).slice(0,4);const imgs=[];
    for(const u of urls){try{imgs.push(await loadImage(proxy(u)))}catch{}}
    const x=40,y=220,w=1000,h=650,g=12;
    roundRect(ctx,x,y,w,h,26,'#f3f3f3','#2a3037');
    if(imgs.length===1)cover(ctx,imgs[0],x,y,w,h,26);
    else if(imgs.length===2){cover(ctx,imgs[0],x,y,(w-g)/2,h,26);cover(ctx,imgs[1],x+(w+g)/2,y,(w-g)/2,h,26)}
    else if(imgs.length===3){const lw=650,rw=w-lw-g;cover(ctx,imgs[0],x,y,lw,h,26);cover(ctx,imgs[1],x+lw+g,y,rw,(h-g)/2,22);cover(ctx,imgs[2],x+lw+g,y+(h+g)/2,rw,(h-g)/2,22)}
    else if(imgs.length>=4){const cw=(w-g)/2,ch=(h-g)/2;cover(ctx,imgs[0],x,y,cw,ch,24);cover(ctx,imgs[1],x+cw+g,y,cw,ch,24);cover(ctx,imgs[2],x,y+ch+g,cw,ch,24);cover(ctx,imgs[3],x+cw+g,y+ch+g,cw,ch,24)}

    let cy=910;
    ctx.font='700 24px Arial';ctx.fillStyle='#939aa3';ctx.fillText(CAT[product.category]||product.category||'',1020,cy);
    cy+=42;
    const rows=[];
    if((product.colors||[]).length)rows.push(['اللون',(product.colors||[]).join(' · ')]);
    if((product.sizes||[]).length)rows.push(['المقاسات',(product.sizes||[]).join(' · ')]);else if(product.dimensions)rows.push(['الأبعاد',product.dimensions]);
    const specs=Object.entries(product.keySpecs||{}).filter(([,v])=>v!=null&&v!==''&&v!==false).slice(0,4);
    for(const [k,v] of specs){const label=SPEC_LABELS[k]||k;if(!rows.some(r=>r[0]===label&&r[1]===valueText(v)))rows.push([label,valueText(v)])}
    for(const [label,val] of rows.slice(0,6)){
      roundRect(ctx,40,cy-29,1000,58,15,'#12161b','#2a3037');
      ctx.fillStyle='#d6a84b';ctx.font='700 22px Arial';ctx.fillText(label,1008,cy+7);
      ctx.fillStyle='#f5f1e8';ctx.font='600 22px Arial';ctx.textAlign='left';ctx.direction='ltr';
      let t=String(val);while(t.length>4&&ctx.measureText(t).width>720)t=t.slice(0,-2);if(t!==String(val))t+='…';ctx.fillText(t,68,cy+7);
      ctx.textAlign='right';ctx.direction='rtl';cy+=68;
      if(cy>1290)break;
    }
    ctx.strokeStyle='#2a3037';ctx.beginPath();ctx.moveTo(40,1310);ctx.lineTo(1040,1310);ctx.stroke();
    ctx.fillStyle='#777f88';ctx.font='500 18px Arial';ctx.fillText('بطاقة منتج جاهزة للمشاركة',1020,1338);
    return canvas;
  }
  const blobFrom=canvas=>new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.95));
  async function preview(product,proxy,imgEl){const canvas=await build(product,proxy);imgEl.src=canvas.toDataURL('image/png');imgEl.style.display='block';return canvas}
  async function download(product,proxy){const canvas=await build(product,proxy),blob=await blobFrom(canvas);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='trendy-product-card.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
  async function share(product,proxy){const canvas=await build(product,proxy),blob=await blobFrom(canvas),file=new File([blob],'trendy-product-card.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:product.name||'Product'});return true}await download(product,proxy);return false}
  window.TrendyCard={build,preview,download,share};
})();
