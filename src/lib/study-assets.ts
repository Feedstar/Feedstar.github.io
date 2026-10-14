import arm from '../../public/examples/arm.xml?raw';
import linkage from '../../public/examples/studies/linkage.xml?raw';
import tendon from '../../public/examples/studies/tendon.xml?raw';
import scanner from '../../public/examples/studies/scanner.xml?raw';
export const studyXML = { 'inverse-kinematics': arm, linkage, tendon, scanner };
export type StudyId = keyof typeof studyXML;
