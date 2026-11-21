; Include do NSIS (electron-builder). A logica de instalacao vive em passos.ts (executada por executar.mjs).
; Nada de segredo aqui; o kit (agentes/skills) NAO vai para o repositorio do cliente.

!macro customInstall
  ; 1) Pasta das obras: sempre em %USERPROFILE%\Atlas\Obras (nunca Desktop/Documentos, por causa do OneDrive)
  CreateDirectory "$PROFILE\Atlas"
  CreateDirectory "$PROFILE\Atlas\Obras"

  ; 2) Node e Claude Code: bootstrap em PowerShell + executarPlano (refazivel sem estragar nada)
  DetailPrint "Preparando o seu computador..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\instalador\instalar.ps1"'
  Pop $0
  StrCmp $0 "0" +2 0
    MessageBox MB_ICONEXCLAMATION "Algo não deu certo na instalação. Abra o Atlas de novo para tentarmos continuar de onde parou." /SD IDOK

  ; 3) Atalho na Área de Trabalho: SEM flag (depois de ativado, o app cai em "minhas obras")
  CreateShortCut "$DESKTOP\Atlas · minhas obras.lnk" "$INSTDIR\Atlas.exe" "" "$INSTDIR\Atlas.exe" 0

  ; 4) So nesta primeira instalacao: abre o app direto na ativacao (F02)
  ; $EXEFILE = nome do instalador baixado (Atlas-Instalador-<codigo>.exe): o app tira dele o codigo do link do e-mail.
  Exec '"$INSTDIR\Atlas.exe" --tela=F02 "--instalador=$EXEFILE"'
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Atlas · minhas obras.lnk"
  ; A pasta das obras é do cliente: NUNCA é apagada.
!macroend
