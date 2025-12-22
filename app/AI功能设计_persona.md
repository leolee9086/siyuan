基本描述:

除了简单的提示词之外,允许将一些文档作为AI的persona档案使用

结构:

persona文档是一个普通的文档块,为了简洁,我们限定只有具有自定义属性custom-ai-persona的文档成为一个AI的人格文档

初始系统提示词:

persona文档中的所有被设置custom-chat-role为system的块被视为系统提示词块

系统提示词块可以是动态的或者是静态的

动态系统提示提块就是具有custom-chat-role=system的嵌入块

系统提示词生成过程是将所有这些块"拣选"出来,然后简单连接在一起

系统提示词连接时,只考虑文档的直接子块的属性

系统提示词连接时,跳过所有中间的不符合custom-chat-role=system的块

每一轮发送时,这些提示词将被重组为消息的第一条内容

聊天记录:

所有custom-chat-role=user和custom-chat-role=assistant的块

连接时,忽略所有非聊天记录块,按照顺序连接和转化为聊天记录格式并发送

工具:

persona块中所有符合条件的JavaScript块都视为工具

符合条件指经过AST检查,导出了以下三个值:

inputs:mcp标准的inputs

outputs:mcp标准的outputs

name:标准的工具名称

executor:执行函数,必须是异步的

使用对应persona的AI,可以在工具调用时直接调用这些代码块

记忆:

所有没有功能性属性的块视为AI的"记忆"

记忆不限制长度

AI可以简单地主动发起查询获取自己的记忆内容,这个查询需要极其简单
