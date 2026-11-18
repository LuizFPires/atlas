; Include do NSIS (electron-builder). Espelha instalador/passos.ts — mantenha os dois iguais.
; Nada de segredo aqui; o kit (agentes/skills) NÃO vai para o repositório do cliente.

!macro customInstall
  ; 1) Pasta das obras: sempre em %USERPROFILE%\Atlas\Obras (nunca Desktop/Documentos, por causa do OneDrive)
  CreateDirectory "$PROFILE\Atlas"
  CreateDirectory "$PROFILE\Atlas\Obras"

  ; 2) Node, Claude Code e plugin Atlas: feitos pelo script (winget/npm), refazível sem estragar nada
  DetailPrint "Preparando o seu computador..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\instalador\instalar.ps1" -Obras "$PROFILE\Atlas\Obras"'
  Pop $0
  StrCmp $0 "0" +2 0
    MessageBox MB_ICONEXCLAMATION "Algo não deu certo na instalação. Abra o Atlas de novo para tentarmos continuar de onde parou."

  ; 3) Atalho na Área de Trabalho
  CreateShortCut "$DESKTOP\Atlas · minhas obras.lnk" "$INSTDIR\Atlas.exe" "--tela=F02" "$INSTDIR\Atlas.exe" 0

  ; 4) Ao terminar, abre o app direto na ativação (F02)
  Exec '"$INSTDIR\Atlas.exe" --tela=F02'
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Atlas · minhas obras.lnk"
  ; A pasta das obras é do cliente: NUNCA é apagada.
!macroend
