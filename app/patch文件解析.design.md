调整webpack配置,要求:

1.同一个路径下,如果存在XXXX.patch.ts,那么所有对XXXX.ts的引用,应该被重定向到XXXX.patch.ts.
2.其它后缀名以此类推