/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { ISchema, useForm } from '@formily/react';
import { uid } from '@formily/shared';
import { MenuProps } from 'antd';
import React, { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionContextProvider,
  DropdownVisibleContext,
  SchemaComponent,
  useActionContext,
  useCurrentUserContext,
  useRequest,
  useSystemSettings,
} from '../';
import { useAPIClient } from '../api-client';

const useCloseAction = () => {
  const { setVisible } = useActionContext();
  const form = useForm();
  return {
    async run() {
      setVisible(false);
      form.submit((values) => {
        console.log(values);
      });
    },
  };
};

const useCurrentUserValues = (options) => {
  const ctx = useCurrentUserContext();
  return useRequest(() => Promise.resolve(ctx.data), options);
};

const useSaveCurrentUserValues = () => {
  const ctx = useCurrentUserContext();
  const { setVisible } = useActionContext();
  const form = useForm();
  const api = useAPIClient();
  return {
    async run() {
      const values = await form.submit<any>();
      setVisible(false);
      await api.resource('users').updateProfile({
        values,
      });
      ctx.mutate({
        data: {
          ...ctx?.data?.data,
          ...values,
        },
      });
    },
  };
};

const schema: ISchema = {
  type: 'object',
  properties: {
    [uid()]: {
      'x-decorator': 'Form',
      'x-decorator-props': {
        useValues: '{{ useCurrentUserValues }}',
      },
      'x-component': 'Action.Drawer',
      'x-component-props': {
        zIndex: 10000,
      },
      type: 'void',
      title: '{{t("Edit profile")}}',
      properties: {
        nickname: {
          type: 'string',
          title: "{{t('Nickname')}}",
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-disabled': '{{ enableEditProfile === false }}',
        },
        username: {
          type: 'string',
          title: '{{t("Username")}}',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-validator': { username: true },
          required: true,
          'x-disabled': '{{ enableEditProfile === false }}',
        },
        email: {
          type: 'string',
          title: '{{t("Email")}}',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-validator': 'email',
          'x-disabled': '{{ enableEditProfile === false }}',
        },
        phone: {
          type: 'string',
          title: '{{t("Phone")}}',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-disabled': '{{ enableEditProfile === false }}',
        },
        footer: {
          'x-component': 'Action.Drawer.Footer',
          type: 'void',
          properties: {
            cancel: {
              title: 'Cancel',
              'x-component': 'Action',
              'x-component-props': {
                useAction: '{{ useCloseAction }}',
              },
            },
            submit: {
              title: 'Submit',
              'x-component': 'Action',
              'x-disabled': '{{ enableEditProfile === false }}',
              'x-component-props': {
                type: 'primary',
                useAction: '{{ useSaveCurrentUserValues }}',
              },
            },
          },
        },
      },
    },
  },
};

export const useEditProfile = () => {
  const ctx = useContext(DropdownVisibleContext);
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();
  const { data } = useSystemSettings() || {};
  const { enableEditProfile } = data?.data || {};
  const result = useMemo<MenuProps['items'][0]>(() => {
    return {
      key: 'profile',
      eventKey: 'EditProfile',
      onClick: () => {
        setVisible(true);
        ctx?.setVisible(false);
      },
      label: (
        <div>
          {t('Edit profile')}
          <ActionContextProvider value={{ visible, setVisible }}>
            <div onClick={(e) => e.stopPropagation()}>
              <SchemaComponent
                scope={{ useCurrentUserValues, useCloseAction, useSaveCurrentUserValues, enableEditProfile }}
                schema={schema}
              />
            </div>
          </ActionContextProvider>
        </div>
      ),
    };
  }, [visible]);

  if (enableEditProfile === false) {
    return null;
  }

  return result;
};
