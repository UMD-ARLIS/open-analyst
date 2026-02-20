import { WelcomeView } from '~/components/WelcomeView';

export { loader } from './_app._index.loader.server';

export default function AppIndex() {
  return <WelcomeView />;
}
