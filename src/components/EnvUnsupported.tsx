import { Panel } from 'primereact/panel';

export function EnvUnsupported() {

  const headerTemplate = (options: any) => {
    const className = `${options.className} justify-content-space-between`;

    return (
      <div className={className}>
        <div className='flex align-items-center gap-2'>
          <span className='font-bold'>Ой</span>
        </div>
      </div>
    );
  };
          
  return (
    <div>
      <div className='app p-0'/>
      <Panel
        className='shadow-5 mx-1'
        headerTemplate={headerTemplate}
      >
        Окружение не приспособлено для запуска этого приложения
      </Panel>
    </div>
  );
}