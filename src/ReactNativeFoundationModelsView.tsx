import { requireNativeView } from 'expo';
import * as React from 'react';

import { ReactNativeFoundationModelsViewProps } from './ReactNativeFoundationModels.types';

const NativeView: React.ComponentType<ReactNativeFoundationModelsViewProps> =
  requireNativeView('ReactNativeFoundationModels');

export default function ReactNativeFoundationModelsView(props: ReactNativeFoundationModelsViewProps) {
  return <NativeView {...props} />;
}
