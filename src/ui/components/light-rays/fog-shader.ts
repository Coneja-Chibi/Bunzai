/** Evolving, domain-warped clouds confined to the stage floor, rendered with the spotlight context. */
export const FOG_FRAGMENT = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec3 fogColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), u.x),
             mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), u.x), u.y);
}
float cloud(vec2 p) {
  float n = 0.0, amplitude = .5;
  for (int i = 0; i < 3; i++) {
    n += amplitude * noise(p);
    p = mat2(.8, -.6, .6, .8) * p * 2.03 + 7.1;
    amplitude *= .4;
  }
  return n;
}
void main() {
  vec2 uv = vec2(gl_FragCoord.x / iResolution.x, 1.0 - gl_FragCoord.y / iResolution.y);
  float t = iTime * .16;
  vec2 p = vec2(uv.x * iResolution.x / iResolution.y * 2.8 - t, uv.y * 6.0);
  vec2 swirl = vec2(cloud(p * .65 + vec2(t * .4, -t * .6)), cloud(p * .65 + vec2(-t * .3, t * .5) + 13.4));
  float density = cloud(p + (swirl - .5) * 2.0 + vec2(0.0, sin(t) * .3));
  float floorMask = smoothstep(.60, .80, uv.y) * (1.0 - smoothstep(.88, .98, uv.y));
  float alpha = smoothstep(.10, .75, density) * floorMask * .30;
  gl_FragColor = vec4(fogColor * alpha, alpha);
}`;
