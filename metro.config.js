const { getDefaultConfig } = require('expo/metro-config');

// ใช้ไฟล์ .svg จาก Figma เป็น component โดยตรง (react-native-svg-transformer)
const config = getDefaultConfig(__dirname);
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
// .glb = โมเดล 3D (react-three-fiber) · .txt = คลังความรู้สำหรับ AI ค้น (assets/kb)
config.resolver.assetExts = [...config.resolver.assetExts.filter((ext) => ext !== 'svg'), 'glb', 'txt'];
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// three มีทั้ง ESM (import) และ CJS (require) — react-three-fiber/native ใช้ require ส่วนโค้ดเราใช้ import
// ถ้าปล่อยไว้จะได้ three 2 ชุด (คำเตือน "Multiple instances of Three.js") แล้ว r3f ตั้งค่า position ฯลฯ ไม่ได้บน iOS/Android
// → บังคับให้ 'three' ทุกที่ชี้ไฟล์เดียวกัน
const threeEntry = require('path').resolve(__dirname, 'node_modules/three/build/three.cjs');
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: threeEntry };
  return upstreamResolve ? upstreamResolve(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
