# 🛒 Lista de Compras Inteligente

PWA completa para gestão de compras — offline, responsiva, pronta para Google Play Store via Capacitor.

---

## 📁 Estrutura do Projeto

```
lista-compras/
├── index.html          ← App shell + HTML semântico
├── style.css           ← Design system completo (CSS Variables)
├── app.js              ← Lógica da aplicação (localStorage)
├── manifest.json       ← PWA manifest (instalável)
├── service-worker.js   ← Offline + cache
└── icons/              ← Ícones (gerar com a ferramenta abaixo)
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-192.png
    └── icon-512.png
```

---

## 🚀 Instalação Local

### Opção 1 — Live Server (VS Code)
1. Abrir pasta no VS Code
2. Instalar extensão **Live Server**
3. Clicar em "Go Live" na barra de status
4. Aceder a `http://localhost:5500`

### Opção 2 — npx serve (sem instalação permanente)
```bash
npx serve .
```

### Opção 3 — Python HTTP Server
```bash
# Python 3
python -m http.server 8080
# Aceder: http://localhost:8080
```

> ⚠️ O Service Worker **não funciona** com `file://`. Use sempre um servidor HTTP.

---

## 🎨 Gerar Ícones

Use o site [realfavicongenerator.net](https://realfavicongenerator.net) ou [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator):

```bash
npx pwa-asset-generator icon-source.png ./icons --manifest manifest.json --index index.html
```

Tamanhos necessários: 72, 96, 128, 192, 512 px.

---

## 📱 Converter para Android com Capacitor

### 1. Inicializar projeto Capacitor

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Lista+" "pt.seudomain.listacompras" --web-dir "."
npx cap add android
```

### 2. Abrir no Android Studio

```bash
npx cap sync android
npx cap open android
```

### 3. Configurar AdMob no Android

```bash
npm install @capacitor-community/admob
npx cap sync android
```

Em `android/app/src/main/AndroidManifest.xml`, adicionar dentro de `<application>`:
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"/>
```

No `app.js`, substituir os placeholders:
```javascript
// Substituir em AdMob.showBanner(), maybeInterstitial(), showRewarded():
'ca-app-pub-XXXXXX/XXXXXX' → 'ca-app-pub-SEU_ID_REAL/SEU_UNIT_ID'
```

### 4. Ativar AdMob na app

Descomentar/ativar no `boot()`:
```javascript
await AdMob.init();
await AdMob.showBanner();
```

---

## 🏪 Publicar na Google Play Store

### Pré-requisitos
- Conta Google Play Console (taxa única €25)
- Android Studio instalado
- Java JDK 17+

### Passos

1. **Build release APK/AAB no Android Studio:**
   - `Build > Generate Signed Bundle / APK`
   - Escolher `Android App Bundle (.aab)`
   - Criar ou usar keystore existente

2. **Google Play Console:**
   - Criar nova app em [play.google.com/console](https://play.google.com/console)
   - Preencher: nome, descrição, screenshots, ícone 512×512
   - Categoria: `Produtividade`
   - Classificação de conteúdo: completar questionário (resultado: Para todos)
   - Política de privacidade: obrigatória (criar página simples)

3. **Upload do AAB:**
   - Ir a `Produção > Versões > Criar versão`
   - Fazer upload do `.aab` gerado

4. **Revisão e publicação:**
   - Submeter para revisão
   - Aprovação normalmente em 24-72h

### Política de Privacidade (mínimo)
```
Esta aplicação não recolhe dados pessoais. 
Todos os dados são guardados localmente no dispositivo.
Utiliza Google AdMob para publicidade (ver política da Google).
```

---

## 💰 Estrutura AdMob

| Tipo | Unidade | Quando mostrar |
|------|---------|----------------|
| Banner | Rodapé | Home + Histórico |
| Interstitial | Full-screen | Após criar 5 listas / abrir 10 |
| Rewarded | Vídeo | Para desbloquear funcionalidades premium |

### Limites implementados
- Interstitial: máximo 1 por 3 minutos
- Banner: nunca durante edição/formulários

---

## ⚡ Performance (Lighthouse targets)

| Métrica | Target |
|---------|--------|
| Performance | > 90 |
| Accessibility | > 90 |
| Best Practices | > 90 |
| SEO | > 85 |
| PWA | ✅ |

---

## 🔧 Futuras Melhorias

- [ ] Sincronização Firebase Firestore (multi-dispositivo)
- [ ] Compras In-App (remover anúncios, temas premium)
- [ ] Exportação PDF da lista
- [ ] Partilha de lista por link
- [ ] Widget Android (lista rápida no ecrã inicial)
- [ ] Integração com supermercados (preços reais)
- [ ] Dark mode
- [ ] Reconhecimento de voz para adicionar produtos

---

## 📄 Licença

MIT — livre para uso pessoal e comercial.
