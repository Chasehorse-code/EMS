# ChaseHorse EMS — Employee Management System

Full-stack field-task management platform for ChaseHorse logistics.

## Architecture

| Layer | Technology | Hosting |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite + Tailwind CSS | Vercel |
| **Backend API** | Spring Boot 3.4 (Java 21) | Railway / Render |
| **Database** | PostgreSQL (Supabase) | Supabase |
| **Auth** | Supabase Auth (JWT) | Supabase |
| **Email** | Zoho Mail SMTP | — |

## Project Structure

```
chasehorse/
├── src/                    # React frontend source
│   ├── api/                # HTTP client & REST API layer
│   ├── components/         # UI components (auth, tasks, tracking…)
│   ├── config/             # Supabase client, access rules
│   ├── context/            # React context providers
│   ├── pages/              # Route pages
│   └── website/            # Public marketing website
├── backend/erp-api/        # Spring Boot REST API
│   ├── src/main/java/      # Controllers, services, security
│   ├── src/main/resources/ # Flyway migrations, config
│   └── Dockerfile          # Production Docker image
├── packages/               # Shared workspace packages
│   ├── api-client/         # OpenAPI contract types
│   ├── design-tokens/      # Shared design tokens
│   └── domain/             # Domain models
└── apps/mobile/            # React Native / Expo mobile app
```

## Local Development

### Prerequisites
- Node.js 18+
- Java 21 (JDK)
- Maven 3.9+

### Frontend
```bash
cd chasehorse
cp .env.example .env.local
# Edit .env.local with your Supabase keys
npm install
npm run dev        # → http://localhost:5173
```

### Backend
```bash
cd chasehorse/backend/erp-api
cp .env.example .env
# Edit .env with your database and SMTP credentials
./mvnw spring-boot:run   # → http://localhost:8080
```

## Deployment

### Frontend → Vercel

1. **Import** this repository in [Vercel Dashboard](https://vercel.com/new)
2. Set **Root Directory** to `chasehorse`
3. Framework: **Vite** (auto-detected)
4. Add environment variables in Vercel settings:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_BASE_URL` | `https://your-backend.railway.app/api/v1` |
   | `VITE_SUPABASE_URL` | `https://phxybimufcrsnxfepiuz.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

5. Deploy! Vercel will run `npm install && npm run build` automatically.

### Backend → Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect this GitHub repository
3. Set **Root Directory** to `chasehorse/backend/erp-api`
4. Railway auto-detects the Dockerfile
5. Add environment variables (see `backend/erp-api/.env.production.example`)
6. **Important**: Set `CORS_ALLOWED_ORIGINS` to your Vercel URL

### Backend → Render (Alternative)

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect this repository
3. Set **Root Directory** to `chasehorse/backend/erp-api`
4. Render uses the `render.yaml` blueprint
5. Add environment variables (see `backend/erp-api/.env.production.example`)

## Environment Variables

### Frontend (Vercel)
See [`.env.production.example`](chasehorse/.env.production.example)

### Backend (Railway/Render)
See [`backend/erp-api/.env.production.example`](chasehorse/backend/erp-api/.env.production.example)

> **⚠️ Security**: Never commit real secrets. Use your hosting platform's secret manager.

## API Endpoints

The backend exposes REST endpoints under `/api/v1/`:
- `/health` — Health check
- `/dashboard/stats` — Dashboard statistics
- `/tasks` — Task CRUD & lifecycle
- `/employees` — Employee management
- `/customers` — Customer management
- `/evidence` — Evidence submission & review
- `/approvals` — Approval workflow
- `/wallets` — Wallet & transactions
- `/tickets` — Support tickets
- `/checklist-templates` — Checklist management
- `/public/enquiries` — Public enquiry forms (no auth)

## License

Proprietary — ChaseHorse Logistics Pvt. Ltd.
