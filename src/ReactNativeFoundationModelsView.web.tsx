import * as React from 'react';

import { ReactNativeFoundationModelsViewProps } from './ReactNativeFoundationModels.types';

export default function ReactNativeFoundationModelsView(props: ReactNativeFoundationModelsViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
