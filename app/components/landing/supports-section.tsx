const Devicon = (props: { name: string }): JSX.Element => {
  return (
    <div>
      <i className={props.name}></i>
    </div>
  );
};

export const SupportsSection = (): JSX.Element => {
  return (
    <div className="flex flex-col justify-content text-center text-slate-500">
      <span className="uppercase font-light mb-4">Supports, among others:</span>
      <div className="flex justify-center mx-2">
        <div className="w-[34rem] flex flex-wrap justify-center text-3xl sm:text-5xl gap-4">
          <Devicon name="devicon-typescript-plain" />
          <Devicon name="devicon-rust-plain" />
          <Devicon name="devicon-go-original-wordmark" />
          <Devicon name="devicon-java-plain" />
          <Devicon name="devicon-cplusplus-plain" />
          <Devicon name="devicon-denojs-original" />
          <Devicon name="devicon-python-plain" />
          <Devicon name="devicon-kotlin-plain" />
        </div>
      </div>
    </div>
  );
};
