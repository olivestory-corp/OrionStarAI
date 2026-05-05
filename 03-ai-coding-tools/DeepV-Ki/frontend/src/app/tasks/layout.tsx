import React from 'react';

export const metadata = {
  title: 'Wiki Generation Task',
  description: 'Track your wiki generation task progress',
};

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
