import kernelApiDefine from "./kernelApiDefine.js";
import { writeFile, unlink } from 'fs/promises'; // 使用 Node.js 内置的 fs/promises 模块
import { fileURLToPath, pathToFileURL } from 'url'; // 用于转换 import.meta.url 和生成文件URL
import { dirname, join } from 'path'; // 用于路径操作

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// const metaURL = import.meta.url; // 这一行似乎没有实际用到了，可以考虑移除
//从GitHub获取后端插件内容

let goFileURL ='https://raw.githubusercontent.com/siyuan-note/siyuan/refs/heads/master/kernel/api/router.go'
// metaURL.replace("genKernelApi.js", "") + "router.go";
let goContent = await (await fetch(goFileURL)).text();
let goLines = goContent.split("\n");
let funStartIndex = goLines.findIndex((item) => {
  return item.startsWith("func ServeAPI");
});
let pre = `export class  kernelApiList{
    constructor(option={ 
        // 原来的环境相关默认值移到构造函数内部逻辑中
        思源伺服协议:"http",
		apitoken:""
		
    }){
    let defaultHostname = '127.0.0.1';
    let defaultPort = '6806';
    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') { // 浏览器环境
        defaultHostname = globalThis.location.hostname;
        defaultPort = globalThis.location.port || ''; 
    }

    let 思源伺服ip =  option.思源伺服ip||option.siYuanIp||defaultHostname;
    let 思源伺服端口 =  option.思源伺服端口||option.siYuanPort||defaultPort;
    let 思源伺服协议 =  option.思源伺服协议||option.siYuanScheme||"http";
	this.apitoken =  option.apitoken||"";
  this.思源伺服地址 = 思源伺服协议+ "://"+思源伺服ip+(思源伺服端口 ? (":"+思源伺服端口) : ''); // 端口存在才拼接
	if(option.siYuanServiceURL){this.思源伺服地址=option.siYuanServiceURL}
  if(option.思源伺服地址){this.思源伺服地址=option.思源伺服地址}
  this.sql=(...args)=>{return this.SQL(...args)}
  `;
let after = `
async set(方法, 路径, 英文名, 中文名) {
  this[英文名] = this.生成方法(方法, 路径).bind(this);
  this[英文名]["raw"] = this.生成方法(方法, 路径, true).bind(this);
  this[英文名]["sync"] = this.生成同步方法(方法, 路径, true).bind(this);
  中文名 ? (this[中文名] = this[英文名]) : null;
  this[路径] = this[英文名];
}
async set(方法, 路径, 英文名, 中文名) {
	this[英文名] = this.生成方法(方法, 路径).bind(this);
	this[英文名]["raw"] = this.生成方法(方法, 路径, true).bind(this);
	this[英文名]["sync"] = this.生成同步方法(方法, 路径, true).bind(this);
	中文名 ? (this[中文名] = this[英文名]) : null;
	this[路径] = this[英文名];
  }
  生成同步方法(方法, 路径, flag) {
	return (data) => {
	  const xhr = new XMLHttpRequest();
	  xhr.open(方法, this.思源伺服地址 + 路径, false);
	  xhr.setRequestHeader("Content-Type", "application/json");
	  xhr.send(JSON.stringify(data));
	  return JSON.parse(xhr.responseText)["data"];
	};
  }
  生成方法(方法,路径,flag){
    return async function(data,apitoken="",callback){
        let resData  = null
        if (data instanceof FormData) {
            // data = data; // This line is redundant
        } else {
            data = JSON.stringify(data);
        }   
        let head =   {
            'Authorization': 'Token '+ this.apitoken,

            'user-agent': 'Mozilla Mobile/4.0 MDN Example',
        }
        if (!this.apitoken){
            head={
                'user-agent': 'Mozilla Mobile/4.0 MDN Example',

            }
        }  
        await fetch(this.思源伺服地址+路径,{
            body: data,
            method:方法,
            headers:head,
        }).then(function(response){resData= response.json()})
        let realData = await resData
        if(!flag){
        if(callback){callback(realData.data?realData.data:null)}
        return realData.data?realData.data:null    
        }
        else{
            if(callback){callback(realData?realData:null)}
            return realData?realData:null    
        }
    }
}
}

export default new kernelApiList({        
  // 构造函数内部会根据环境设置IP和端口，这里可以不传或只传通用配置
  // 思源伺服协议:"http", // 如果构造函数已有默认，这里可省略
  // apitoken:""         // 如果构造函数已有默认，这里可省略
});

// 从思源的后端接口文件计算而来
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
`;
let preLines = pre.toString().split("\n");
let 初始定义序列 =[]
goLines.forEach((line, index) => {
  if (index <= funStartIndex) {
    line = preLines[index] || "";
    goLines[index] = line;
  } else {
    if (line && line.indexOf("ginServer.Handle") > 0) {
      line = line.split("//")[0];
    }else{
      if (line&&line.trim().startsWith("ginServer.Any")){
        line=""
      }
    }
    line = line
      .replace("ginServer.Handle", "this.set")
      .replace("model.CheckAuth,", "")
      .replace("model.CheckReadonly,", "")
      .replace("model.CheckAdminRole,","")
      .replace("model.", "");
    let functionName = line.split(",").pop().replace(")", "").trim();
    if (line && line.indexOf("this.set") > 0) {
      // BEGINNING OF KERNELAPIDEFINE USAGE (still potentially problematic if it's an array)
      if (!kernelApiDefine[functionName]) { 
        let 初始定义 = line
          .replace("\t", "")
          .replace("this.set", "")
          .replace("(", "")
          .replace(")", "")
          .replace(/\'/g, "")
          .replace(/\"/g, "")
          .split(",")
          .map((item) => {
            return item.trim();
          });
          初始定义序列.push(初始定义)
        console.warn(
          functionName,
          "未定义,初始定义应当为:",
          初始定义
        );
        line = line.replace(
          functionName + ")",
          `"${functionName}")//仅生成函数,尚未定义`
        );
      } else if (!kernelApiDefine[functionName].中文名) {
        console.warn(functionName, "缺少中文名");
        line = line.replace(functionName + ")", `"${functionName}")`);
      } else {
        line = line.replace(
          functionName + ")",
          `"${functionName}","${kernelApiDefine[functionName].中文名}")`
        );
      }
      // END OF KERNELAPIDEFINE USAGE
    }
    goLines[index] = line;
  }
});
console.warn('以下接口未定义:',初始定义序列)
let jsContent = goLines.join("\n") + after;

// --- BEGIN MODIFIED DYNAMIC IMPORT ---
let _module = { default: '' };
const tempModuleFilename = '_temp_gen_api_module_.mjs';
const tempModulePath = join(__dirname, tempModuleFilename);

try {
  await writeFile(tempModulePath, jsContent, 'utf8');
  const tempModuleURL = pathToFileURL(tempModulePath).href;
  _module = await import(tempModuleURL);
  console.log("临时模块动态导入成功。");
} catch (e) {
  console.warn("动态导入生成的临时模块 (_temp_gen_api_module_.mjs) 时发生错误: ", e);
  // _module 将保持 { default: '' }
} finally {
  try {
    await unlink(tempModulePath);
    console.log("临时模块文件已删除。");
  } catch (e) {
    // console.warn("删除临时模块文件失败: ", e); // Might be noisy if file wasn't created
  }
}
// --- END MODIFIED DYNAMIC IMPORT ---

let kernelApi = _module['default'];

const outputPath = join(__dirname, 'kernelApi.js'); 

await writeFile(outputPath, jsContent); 
console.log(`kernelApi.js generated successfully at ${outputPath}`);

export default kernelApi;

// 从思源的后端接口文件计算而来
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>. 