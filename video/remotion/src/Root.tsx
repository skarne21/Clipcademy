import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {Clip} from './Clip';
import sample from './sample.json';
import {ClipProps} from './types';

const metadata: CalculateMetadataFunction<ClipProps> = ({props}) => ({durationInFrames: props.durationInFrames, fps: props.fps});

export const Root: React.FC = () => (
  <Composition id="Clip" component={Clip} width={720} height={1280} fps={30} durationInFrames={300}
    defaultProps={sample as ClipProps} calculateMetadata={metadata} />
);
