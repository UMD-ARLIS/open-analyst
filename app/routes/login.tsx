import type { LoaderFunctionArgs } from 'react-router';
import { redirect, Form } from 'react-router';
import { getSessionUser } from '~/lib/auth/session.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  if (user) return redirect('/');
  return null;
}

export default function LoginPage() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#0f0f0f',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '3rem',
          borderRadius: '12px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <h1 style={{ color: '#e0e0e0', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
          Open Analyst
        </h1>
        <p style={{ color: '#888', marginBottom: '2rem', fontSize: '0.875rem' }}>
          Sign in to continue
        </p>
        <Form method="post" action="/auth/login" reloadDocument>
          <button
            type="submit"
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Sign in
          </button>
        </Form>
      </div>
    </div>
  );
}
