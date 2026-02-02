import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { IPFS_CONSTANTS, MAX_FILE_SIZE } from '@/lib/constants';

/**
 * IPFS API Route - Server-side proxy to Pinata
 *
 * This route keeps Pinata API keys server-side while providing
 * IPFS upload/download/delete functionality to clients.
 *
 * Endpoints:
 * - POST /api/ipfs - Upload file to IPFS via Pinata
 * - GET /api/ipfs?cid=<cid> - Retrieve file from IPFS gateway
 * - DELETE /api/ipfs?cid=<cid> - Unpin content from Pinata
 */

const PINATA_API_URL = 'https://api.pinata.cloud';

/**
 * Validate that a CID has a valid format.
 * Supports both CIDv0 (Qm...) and CIDv1 (bafy...)
 */
function isValidCid(cid: string): boolean {
  return IPFS_CONSTANTS.CID_REGEX.test(cid);
}

/**
 * Check if Pinata credentials are configured.
 */
function hasPinataCredentials(): boolean {
  return Boolean(config.ipfs.pinataApiKey && config.ipfs.pinataSecretKey);
}

/**
 * Create Pinata authorization headers.
 */
function getPinataHeaders(): Record<string, string> {
  return {
    pinata_api_key: config.ipfs.pinataApiKey!,
    pinata_secret_api_key: config.ipfs.pinataSecretKey!,
  };
}

/**
 * POST /api/ipfs - Upload file to IPFS via Pinata
 *
 * Accepts FormData with:
 * - file: The file to upload (required)
 * - name: Optional name for the file
 *
 * Returns:
 * - cid: The IPFS content identifier
 * - size: File size in bytes
 * - timestamp: Upload timestamp
 */
export async function POST(request: NextRequest) {
  try {
    // Check for Pinata credentials
    if (!hasPinataCredentials()) {
      return NextResponse.json(
        { error: 'IPFS storage not configured. Please set PINATA_API_KEY and PINATA_SECRET_KEY.' },
        { status: 503 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');
    const name = formData.get('name') as string | null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No file provided. Please include a file in the form data.' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    // Prepare form data for Pinata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);

    // Add metadata
    const metadata = {
      name: name || 'shade-studio-upload',
      keyvalues: {
        source: 'shade-studio',
        uploadedAt: new Date().toISOString(),
      },
    };
    pinataFormData.append('pinataMetadata', JSON.stringify(metadata));

    // Pin options - keep content pinned
    const pinataOptions = {
      cidVersion: 1,
    };
    pinataFormData.append('pinataOptions', JSON.stringify(pinataOptions));

    // Upload to Pinata
    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: getPinataHeaders(),
      body: pinataFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[IPFS API] Pinata upload failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to upload to IPFS. Please try again.' },
        { status: 502 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      cid: result.IpfsHash,
      size: result.PinSize,
      timestamp: result.Timestamp,
    });
  } catch (error) {
    console.error('[IPFS API] Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error during upload.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ipfs?cid=<cid> - Retrieve file from IPFS gateway
 *
 * Query parameters:
 * - cid: The IPFS content identifier (required)
 *
 * Returns:
 * - The file content with appropriate headers
 * - Cache headers for immutable content
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get('cid');

    if (!cid) {
      return NextResponse.json(
        { error: 'Missing cid parameter.' },
        { status: 400 }
      );
    }

    // Validate CID format to prevent path traversal
    if (!isValidCid(cid)) {
      return NextResponse.json(
        { error: 'Invalid CID format.' },
        { status: 400 }
      );
    }

    // Fetch from gateway
    const gatewayUrl = `${config.ipfs.gatewayUrl}/${cid}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      IPFS_CONSTANTS.REQUEST_TIMEOUT
    );

    try {
      const response = await fetch(gatewayUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json(
            { error: 'Content not found on IPFS.' },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: 'Failed to retrieve content from IPFS.' },
          { status: 502 }
        );
      }

      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      // IPFS content is immutable, so we can cache aggressively
      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-IPFS-CID': cid,
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout fetching from IPFS gateway.' },
          { status: 504 }
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[IPFS API] Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error during download.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ipfs?cid=<cid> - Unpin content from Pinata
 *
 * Query parameters:
 * - cid: The IPFS content identifier to unpin (required)
 *
 * Returns:
 * - success: true if unpinned
 * - cid: The unpinned CID
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check for Pinata credentials
    if (!hasPinataCredentials()) {
      return NextResponse.json(
        { error: 'IPFS storage not configured. Please set PINATA_API_KEY and PINATA_SECRET_KEY.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const cid = searchParams.get('cid');

    if (!cid) {
      return NextResponse.json(
        { error: 'Missing cid parameter.' },
        { status: 400 }
      );
    }

    // Validate CID format
    if (!isValidCid(cid)) {
      return NextResponse.json(
        { error: 'Invalid CID format.' },
        { status: 400 }
      );
    }

    // Unpin from Pinata
    const response = await fetch(`${PINATA_API_URL}/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: getPinataHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Content not found or already unpinned - treat as success
        return NextResponse.json({
          success: true,
          cid,
          message: 'Content was not pinned or already unpinned.',
        });
      }
      const errorText = await response.text();
      console.error('[IPFS API] Pinata unpin failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to unpin content from IPFS.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      cid,
    });
  } catch (error) {
    console.error('[IPFS API] Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error during delete.' },
      { status: 500 }
    );
  }
}
