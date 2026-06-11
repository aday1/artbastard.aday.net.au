import 'react';

declare module 'react' {
  interface InputHTMLAttributes<T> {
    orient?: 'vertical' | 'horizontal';
  }
}
