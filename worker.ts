// 声明环境变量类型
interface Env {
    WORKER_API_KEY: string; // 对应 Secret 类型的环境变量
  }
  
  // ES 模块语法入口
  export default {
    async fetch(
      request: Request,
      env: Env, // 通过参数传递环境变量
      context: ExecutionContext
    ): Promise<Response> {
      return handleRequest(request, env); // 将 env 传递给处理函数
    },
  };
  
  // 主请求处理函数
  async function handleRequest(request: Request, env: Env): Promise<Response> {
    // 处理 CORS 预检请求
    if (request.method === "OPTIONS") {
      return handleOPTIONS(request);
    }
  
    // 提取客户端 API Key
    const apiKey =
      request.headers.get("x-goog-api-key") ||
      request.headers.get("Authorization")?.replace("Bearer ", "");
  
    if (!apiKey) {
      return new Response("Missing Authorization", {
        status: 401,
        headers: corsHeaders(),
      });
    }
  
    // 从环境变量获取预设 Key
    const workerApiKey = env.WORKER_API_KEY; // ✅ 通过 env 参数安全访问
  
    // 验证 Key
    if (apiKey !== workerApiKey) {
      return new Response("Invalid API Key", {
        status: 401,
        headers: corsHeaders(),
      });
    }
  
    // 构建 Gemini API 请求
    const url = new URL(request.url);
    const apiUrl = `https://generativelanguage.googleapis.com${url.pathname}${url.search}`;
  
    // 清理请求头
    const headers = new Headers(request.headers);
    headers.set("x-goog-api-key", apiKey);
    headers.delete("Host");
    headers.delete("Authorization");

    console.log("Forwarding request to:", apiUrl);
    console.log("Forwarding headers:", Object.fromEntries(headers.entries()));

    // 转发请求
    try {
      const apiRequest = new Request(apiUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: "follow",
      });

      const apiResponse = await fetch(apiRequest);

      console.log("Received response status:", apiResponse.status);
      console.log("Received response headers:", Object.fromEntries(apiResponse.headers.entries()));

      // 添加 CORS 头后返回
      return new Response(apiResponse.body, {
        status: apiResponse.status,
        headers: mergeHeaders(apiResponse.headers, corsHeaders()),
      });
    } catch (error: any) { // 明确 error 类型以便访问 message
      console.error("Error fetching from Gemini API:", error.message || error);
      return new Response("Internal Server Error", {
        status: 500,
        headers: corsHeaders(),
      });
    }
  }
  
  // 处理 OPTIONS 预检请求
  function handleOPTIONS(request: Request): Response {
    const reqHeaders = request.headers;
    if (
      reqHeaders.get("Origin") &&
      reqHeaders.get("Access-Control-Request-Method") &&
      reqHeaders.get("Access-Control-Request-Headers")
    ) {
      return new Response(null, {
        headers: {
          ...corsHeaders(),
          "Access-Control-Allow-Headers": reqHeaders.get(
            "Access-Control-Request-Headers"
          )!,
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    return new Response(null, { status: 400 });
  }
  
  // 公共 CORS 头部生成器
  function corsHeaders(): HeadersInit {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*",
    };
  }
  
  // 合并响应头部
  function mergeHeaders(...headers: HeadersInit[]): Headers {
    const merged = new Headers();
    for (const h of headers) {
      new Headers(h).forEach((value, key) => merged.set(key, value));
    }
    return merged;
  }
