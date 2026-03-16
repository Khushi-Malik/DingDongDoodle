#!/bin/bash
# Generate deployment secrets

echo "🔐 Generating secure secrets for deployment..."
echo ""

# Generate WORKER_SECRET
WORKER_SECRET=$(openssl rand -hex 32)
echo "WORKER_SECRET=$WORKER_SECRET"
echo "  ↳ Use this for: RIG_WORKER_SECRET in Vercel, WORKER_SECRET in Render/Railway"

# Generate JWT_SECRET
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=$JWT_SECRET"
echo "  ↳ Use this for: JWT_SECRET in Vercel"

echo ""
echo "✅ Copy the values above to your deployment platforms"
echo ""
echo "💾 Or save to a file:"
echo "   Open your Vercel dashboard at https://vercel.com/settings/tokens"
echo "   Open your Render dashboard at https://dashboard.render.com"
