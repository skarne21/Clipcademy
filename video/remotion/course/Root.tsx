import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {CourseClip} from './CourseClip';
import sample from './sample.json';
import {CourseProps} from './types';

const metadata: CalculateMetadataFunction<CourseProps> = ({props}) => ({durationInFrames: props.durationInFrames, fps: props.fps});

export const CourseRoot: React.FC = () => (
  <Composition id="CourseClip" component={CourseClip} width={720} height={1280} fps={30} durationInFrames={150}
    defaultProps={sample as unknown as CourseProps} calculateMetadata={metadata} />
);
