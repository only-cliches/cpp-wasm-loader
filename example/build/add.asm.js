Module["asm"] = (function(global, env, buffer) {
 "use asm";
 function X(a, b) {
  a = +a;
  b = +b;
  return +(a + b);
 }
 return {
  _add: X
 };
});



