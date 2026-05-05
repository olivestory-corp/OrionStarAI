export default function GitLabTestBanner() {
  return (
    <div style={{
      width: '100%',
      marginTop: '48px',
      padding: '32px',
      backgroundColor: '#fecaca',
      borderWidth: '4px',
      borderColor: '#dc2626',
      borderStyle: 'solid'
    }}>
      <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#991b1b' }}>
        Hello World - GitLab Test Banner
      </h2>
      <p style={{ fontSize: '24px', marginTop: '16px', color: '#b91c1c' }}>
        如果你看到这条消息，说明组件正在正常工作！
      </p>
    </div>
  );
}