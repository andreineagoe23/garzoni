declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.jpeg" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}
declare module "*.gif" {
  const src: string;
  export default src;
}
declare module "*.webp" {
  const src: string;
  export default src;
}

/** vite-imagetools: default export is the built asset URL */
declare module "assets/login-bg.jpg?format=webp&quality=75" {
  const src: string;
  export default src;
}
declare module "assets/register-bg.jpg?format=webp&quality=75" {
  const src: string;
  export default src;
}
