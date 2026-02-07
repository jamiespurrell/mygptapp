import type { Metadata } from 'next';
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Daily Voice Notes & Task Planner',
  description: 'Voice notes and task planner with Clerk authentication',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <header className="topbar">
            <h1>Daily Voice Notes &amp; Task Planner</h1>
            <div className="auth-actions">
              <SignedOut>
                <SignInButton>
                  <button className="btn btn-primary">Sign In</button>
                </SignInButton>
                <SignUpButton>
                  <button className="btn btn-muted">Sign Up</button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
