const { pathToRegexp } = require('path-to-regexp');

// 测试可选参数的行为
const keys = [];
const regexp = pathToRegexp('/users/:id?', keys);

console.log('正则表达式:', regexp);
console.log('参数键:', keys);

// 测试匹配 /users
const match1 = '/users'.match(regexp);
console.log('匹配 /users:', match1);
if (match1) {
  console.log('捕获组 (slice(1)):', match1.slice(1));
}

// 测试匹配 /users/123
const match2 = '/users/123'.match(regexp);
console.log('匹配 /users/123:', match2);
if (match2) {
  console.log('捕获组 (slice(1)):', match2.slice(1));
}