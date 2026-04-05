import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { StreamChat } from "https://esm.sh/stream-chat@8.x.x"

const STREAM_KEY = Deno.env.get('STREAM_KEY')!
const STREAM_SECRET = Deno.env.get('STREAM_SECRET')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.body.json()
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serverClient = StreamChat.getInstance(STREAM_KEY, STREAM_SECRET)
    const token = serverClient.createToken(userId)

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
