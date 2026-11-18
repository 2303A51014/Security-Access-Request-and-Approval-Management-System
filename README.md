# AccessGuard — Security Access Request and Approval Management System

**Student:** GUNDA SARAYU · **Enrollment:** 2303A51014  
**Stack:** React JS, Node.js, Express JS, MongoDB, Docker, Kubernetes

AccessGuard implements the assigned project workflow: employees submit access requests, department managers review them, IT Security performs the final approval, and administrators/security officers can revoke access and inspect the audit trail.

## Features and screens

1. Secure login with role-based access (Admin, Employee, Department Manager, IT Security Officer)
2. Dashboard with request metrics and workflow status
3. Access request register
4. New access request form
5. Manager/security approval queue
6. Periodic access review
7. Mandatory reports (requests, pending approvals, reviews, audit)
8. User access audit and administrator directory

Requests move through `Pending Manager → Pending Security → Approved`. Every grant, rejection, and revocation creates an audit record.

## Install and run locally

Prerequisites: Node.js 22+, MongoDB 7/8 running locally, and npm.

```powershell
cd "C:\Users\Chandrahas Gunda\Desktop\Security Access Request and Approval Management System"
npm install
Copy-Item server\.env.example server\.env
npm run seed
npm run dev
```

Open `http://localhost:5173`. All seeded users use `Password123!`:

| Account | Role |
|---|---|
| employee@security.local | Employee |
| manager@security.local | Department Manager |
| security@security.local | IT Security Officer |
| admin@security.local | Admin |

## Docker

```powershell
docker compose up --build
```

The production image serves the React client and API on `http://localhost:5000`. Seed data can be loaded with `docker compose exec app npm run seed --workspace server`.

## Kubernetes

Build the image in the cluster runtime, then deploy:

```powershell
docker build -t security-access-management:latest .
kubectl apply -f k8s/deployment.yaml
kubectl get pods,services
```

For a real cluster, replace the example JWT secret with a generated secret and use a persistent MongoDB volume/service. The manifests include two application replicas, MongoDB, a service, and a Kubernetes secret.

## API overview

- `POST /api/auth/login` — authenticate
- `GET /api/requests` / `POST /api/requests` — request register and submission
- `PATCH /api/requests/:id/decision` — manager/security decision
- `PATCH /api/requests/:id/revoke` — revoke approved access
- `GET /api/reports/summary` — report metrics
- `GET /api/reviews` — approved access review
- `GET /api/audit` — immutable-style access event history
