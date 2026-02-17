import { NextRequest, NextResponse } from 'next/server';

const NETWORK = process.env.NEXT_PUBLIC_NEAR_NETWORK || 'testnet';
const CONTRACT_ID = process.env.NEXT_PUBLIC_SOCIAL_CONTRACT_ID || 'v1.social08.testnet';
const RPC_URL = NETWORK === 'mainnet'
  ? 'https://rpc.mainnet.near.org'
  : 'https://rpc.testnet.near.org';

/**
 * POST /api/social — Proxy for NEAR Social view calls.
 * Avoids CORS issues by making RPC calls server-side.
 *
 * Body: { keys: string[] }
 * Returns: The NEAR Social data for the given keys.
 */
export async function POST(request: NextRequest) {
  try {
    const { keys } = await request.json();

    if (!keys || !Array.isArray(keys)) {
      return NextResponse.json({ error: 'Missing keys array' }, { status: 400 });
    }

    // Encode args for the view function call
    const args = JSON.stringify({ keys });
    const argsBase64 = Buffer.from(args).toString('base64');

    const rpcResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: CONTRACT_ID,
          method_name: 'get',
          args_base64: argsBase64,
        },
      }),
    });

    const rpcData = await rpcResponse.json();

    if (rpcData.error) {
      return NextResponse.json(
        { error: rpcData.error.message || 'RPC error' },
        { status: 502 }
      );
    }

    // Decode the result bytes to JSON
    const resultBytes = rpcData.result?.result;
    if (!resultBytes) {
      return NextResponse.json({});
    }

    const decoded = Buffer.from(resultBytes).toString('utf-8');
    const data = JSON.parse(decoded);

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
