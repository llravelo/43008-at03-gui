import { AsyncView } from './components/AsyncView';
import { Sidebar } from './components/Sidebar';
import { OperationsPage } from './pages/operations/OperationsPage';
import { OpenBundleProvider, useBundleContext } from './state/BundleContext';

export function App() {
  const { summaries, bundle } = useBundleContext();

  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <AsyncView state={summaries} loadingText="Looking for data bundles…">
          {(available) =>
            available.length === 0 ? (
              <p className="status status-error">No bundles in public/bundles. Import simulation results with tools/import_results.py.</p>
            ) : (
              <AsyncView state={bundle} loadingText="Opening bundle…">
                {(opened) => (
                  <OpenBundleProvider bundle={opened} key={opened.id}>
                    <OperationsPage />
                  </OpenBundleProvider>
                )}
              </AsyncView>
            )
          }
        </AsyncView>
      </main>
    </div>
  );
}
