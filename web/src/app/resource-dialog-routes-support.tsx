import {
  type ApplicationDialog,
  type DialogControls,
} from "./application-dialogs";

export type DialogRouteProps<
  Dialog extends ApplicationDialog = ApplicationDialog,
> = {
  dialog: Dialog;
  controls: DialogControls;
};
