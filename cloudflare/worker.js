/**
 * YouTube CORS Proxy - Cloudflare Worker
 * YouTubeへのリクエストを中継し、CORSヘッダーを付与
 */

export default {
  async fetch(request, env, ctx) {
    // CORSヘッダー
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // OPTIONSリクエスト（プリフライト）
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const targetUrl = url.searchParams.get('url');

      if (!targetUrl) {
        return new Response(
          JSON.stringify({ error: 'Missing url parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // YouTubeドメインのみ許可（セキュリティ）
      const target = new URL(targetUrl);
      if (!target.hostname.endsWith('youtube.com') && !target.hostname.endsWith('googleapis.com')) {
        return new Response(
          JSON.stringify({ error: 'Only YouTube domains allowed' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // リクエストオプション
      const fetchOptions = {
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ja,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      };

      // POSTの場合はボディを転送
      if (request.method === 'POST') {
        fetchOptions.body = await request.text();
        fetchOptions.headers['Content-Type'] = 'application/json';
      }

      // YouTubeにリクエスト
      const response = await fetch(targetUrl, fetchOptions);
      const body = await response.text();

      return new Response(body, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('content-type') || 'text/html',
        }
      });

    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
};
