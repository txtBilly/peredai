import Script from 'next/script';

// Yandex Metrica tag for SEO / visitor analytics. Renders nothing until the
// counter id is provided via NEXT_PUBLIC_YANDEX_METRICA_ID, so it's a no-op in
// dev/preview and turns on the moment the env var is set (no code change).
// Data is processed by Yandex in the RF — consistent with the 152-ФЗ stance.
export default function YandexMetrica() {
  const id = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID;
  if (!id) return null;

  return (
    <>
      <Script id="yandex-metrica" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(${id},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${id}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
