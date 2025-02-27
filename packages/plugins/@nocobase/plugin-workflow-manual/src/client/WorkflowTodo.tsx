/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { observer, useField, useFieldSchema, useForm } from '@formily/react';
import { Button, Space, Spin, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  css,
  useCollection,
  useCollectionRecordData,
  useCompile,
  useOpenModeContext,
  usePlugin,
} from '@nocobase/client';

import {
  SchemaComponent,
  SchemaComponentContext,
  TableBlockProvider,
  useAPIClient,
  useActionContext,
  useCurrentUserContext,
  useFormBlockContext,
  useTableBlockContext,
} from '@nocobase/client';
import WorkflowPlugin, {
  DetailsBlockProvider,
  FlowContext,
  JobStatusOptions,
  JobStatusOptionsMap,
  linkNodes,
  useAvailableUpstreams,
  useFlowContext,
} from '@nocobase/plugin-workflow/client';

import { NAMESPACE, useLang } from '../locale';
import { FormBlockProvider } from './instruction/FormBlockProvider';
import { ManualFormType, manualFormTypes } from './instruction/SchemaConfig';

export const nodeCollection = {
  title: `{{t("Task", { ns: "${NAMESPACE}" })}}`,
  name: 'flow_nodes',
  fields: [
    {
      type: 'bigInt',
      name: 'id',
      interface: 'm2o',
      uiSchema: {
        type: 'number',
        title: 'ID',
        'x-component': 'RemoteSelect',
        'x-component-props': {
          fieldNames: {
            label: 'title',
            value: 'id',
          },
          service: {
            resource: 'flow_nodes',
            params: {
              filter: {
                type: 'manual',
              },
            },
          },
        },
      },
    },
    {
      type: 'string',
      name: 'title',
      interface: 'input',
      uiSchema: {
        type: 'string',
        title: '{{t("Title")}}',
        'x-component': 'Input',
      },
    },
  ],
};

export const workflowCollection = {
  title: `{{t("Workflow", { ns: "${NAMESPACE}" })}}`,
  name: 'workflows',
  fields: [
    {
      type: 'string',
      name: 'title',
      interface: 'input',
      uiSchema: {
        title: '{{t("Name")}}',
        type: 'string',
        'x-component': 'Input',
        required: true,
      },
    },
  ],
};

export const todoCollection = {
  title: `{{t("Workflow todos", { ns: "${NAMESPACE}" })}}`,
  name: 'users_jobs',
  fields: [
    {
      type: 'belongsTo',
      name: 'user',
      target: 'users',
      foreignKey: 'userId',
      interface: 'm2o',
      uiSchema: {
        type: 'number',
        title: '{{t("User")}}',
        'x-component': 'RemoteSelect',
        'x-component-props': {
          fieldNames: {
            label: 'nickname',
            value: 'id',
          },
          service: {
            resource: 'users',
          },
        },
      },
    },
    {
      type: 'belongsTo',
      name: 'node',
      target: 'flow_nodes',
      foreignKey: 'nodeId',
      interface: 'm2o',
      isAssociation: true,
      uiSchema: {
        type: 'number',
        title: `{{t("Task", { ns: "${NAMESPACE}" })}}`,
        'x-component': 'RemoteSelect',
        'x-component-props': {
          fieldNames: {
            label: 'title',
            value: 'id',
          },
          service: {
            resource: 'flow_nodes',
          },
        },
      },
    },
    {
      type: 'belongsTo',
      name: 'workflow',
      target: 'workflows',
      foreignKey: 'workflowId',
      interface: 'm2o',
      uiSchema: {
        type: 'number',
        title: `{{t("Workflow", { ns: "${NAMESPACE}" })}}`,
        'x-component': 'RemoteSelect',
        'x-component-props': {
          fieldNames: {
            label: 'title',
            value: 'id',
          },
          service: {
            resource: 'workflows',
          },
        },
      },
    },
    {
      type: 'integer',
      name: 'status',
      interface: 'select',
      uiSchema: {
        type: 'number',
        title: `{{t("Status", { ns: "${NAMESPACE}" })}}`,
        'x-component': 'Select',
        enum: JobStatusOptions,
      },
    },
    {
      name: 'createdAt',
      type: 'date',
      interface: 'createdAt',
      uiSchema: {
        type: 'datetime',
        title: '{{t("Created at")}}',
        'x-component': 'DatePicker',
        'x-component-props': {
          showTime: true,
        },
      },
    },
  ],
};

const NodeColumn = observer(
  () => {
    const field = useField<any>();
    return field?.value?.title ?? `#${field.value?.id}`;
  },
  { displayName: 'NodeColumn' },
);

const WorkflowColumn = observer(
  () => {
    const field = useField<any>();
    return field?.value?.title ?? `#${field.value?.id}`;
  },
  { displayName: 'WorkflowColumn' },
);

const UserColumn = observer(
  () => {
    const field = useField<any>();
    return field?.value?.nickname ?? field.value?.id;
  },
  { displayName: 'UserColumn' },
);

function UserJobStatusColumn(props) {
  const recordData = useCollectionRecordData();
  const labelUnprocessed = useLang('Unprocessed');
  if (recordData?.execution?.status && !recordData?.status) {
    return <Tag>{labelUnprocessed}</Tag>;
  }
  return props.children;
}

export const WorkflowTodo: React.FC & { Drawer: React.FC; Decorator: React.FC } = () => {
  const { defaultOpenMode } = useOpenModeContext();
  const collection = useCollection();

  return (
    <SchemaComponent
      components={{
        NodeColumn,
        WorkflowColumn,
        UserColumn,
        UserJobStatusColumn,
      }}
      schema={{
        type: 'void',
        properties: {
          actions: {
            type: 'void',
            'x-component': 'ActionBar',
            'x-component-props': {
              style: {
                marginBottom: 'var(--nb-spacing)',
              },
            },
            properties: {
              filter: {
                type: 'void',
                title: '{{ t("Filter") }}',
                'x-action': 'filter',
                'x-designer': 'Filter.Action.Designer',
                'x-component': 'Filter.Action',
                'x-use-component-props': 'useFilterActionProps',
                'x-component-props': {
                  icon: 'FilterOutlined',
                },
                'x-align': 'left',
              },
              refresher: {
                type: 'void',
                title: '{{ t("Refresh") }}',
                'x-action': 'refresh',
                'x-component': 'Action',
                'x-use-component-props': 'useRefreshActionProps',
                // 'x-designer': 'Action.Designer',
                'x-toolbar': 'ActionSchemaToolbar',
                'x-settings': 'actionSettings:refresh',
                'x-component-props': {
                  icon: 'ReloadOutlined',
                },
                'x-align': 'right',
              },
            },
          },
          table: {
            type: 'array',
            'x-component': 'TableV2',
            'x-use-component-props': 'useTableBlockProps',
            'x-component-props': {
              rowKey: 'id',
            },
            properties: {
              actions: {
                type: 'void',
                'x-decorator': 'TableV2.Column.Decorator',
                'x-component': 'TableV2.Column',
                'x-component-props': {
                  width: 60,
                },
                title: '{{t("Actions")}}',
                properties: {
                  view: getWorkflowTodoViewActionSchema({ defaultOpenMode, collectionName: collection.name }),
                },
              },
              node: {
                type: 'void',
                'x-decorator': 'TableV2.Column.Decorator',
                'x-component': 'TableV2.Column',
                'x-component-props': {
                  width: null,
                },
                title: `{{t("Task node", { ns: "${NAMESPACE}" })}}`,
                properties: {
                  node: {
                    'x-component': 'NodeColumn',
                    'x-read-pretty': true,
                  },
                },
              },
              workflow: {
                type: 'void',
                'x-decorator': 'TableV2.Column.Decorator',
                'x-component': 'TableV2.Column',
                'x-component-props': {
                  width: null,
                },
                title: `{{t("Workflow", { ns: "workflow" })}}`,
                properties: {
                  workflow: {
                    'x-component': 'WorkflowColumn',
                    'x-read-pretty': true,
                  },
                },
              },
              status: {
                type: 'void',
                'x-decorator': 'TableV2.Column.Decorator',
                'x-component': 'TableV2.Column',
                'x-component-props': {
                  width: 100,
                },
                title: `{{t("Status", { ns: "workflow" })}}`,
                properties: {
                  status: {
                    type: 'number',
                    'x-decorator': 'UserJobStatusColumn',
                    'x-component': 'CollectionField',
                    'x-read-pretty': true,
                  },
                },
              },
              user: {
                type: 'void',
                'x-decorator': 'TableV2.Column.Decorator',
                'x-component': 'TableV2.Column',
                'x-component-props': {
                  width: 140,
                },
                title: `{{t("Assignee", { ns: "${NAMESPACE}" })}}`,
                properties: {
                  user: {
                    'x-component': 'UserColumn',
                    'x-read-pretty': true,
                  },
                },
              },
              createdAt: {
                type: 'void',
                'x-decorator': 'TableV2.Column.Decorator',
                'x-component': 'TableV2.Column',
                'x-component-props': {
                  width: 160,
                },
                properties: {
                  createdAt: {
                    type: 'string',
                    'x-component': 'CollectionField',
                    'x-read-pretty': true,
                  },
                },
              },
            },
          },
        },
      }}
    />
  );
};

export function getWorkflowTodoViewActionSchema({ defaultOpenMode, collectionName }) {
  return {
    name: 'view',
    type: 'void',
    'x-component': 'Action.Link',
    'x-component-props': {
      openMode: defaultOpenMode,
    },
    title: '{{t("View")}}',
    // 1. “弹窗 URL”需要 Schema 中必须包含 uid
    // 2. 所以，在这里加上一个固定的 uid 用以支持“弹窗 URL”
    // 3. 然后，把这段 Schema 完整的（加上弹窗的部分）保存到内存中，以便“弹窗 URL”可以直接使用
    'x-uid': `${collectionName}-view`,
    'x-action': 'view',
    'x-action-context': {
      dataSource: 'main',
      collection: collectionName,
      doNotUpdateContext: true,
    },
    properties: {
      drawer: {
        'x-component': WorkflowTodo.Drawer,
      },
    },
  };
}

function ActionBarProvider(props) {
  // * status is done:
  //   1. form is this form: show action button, and emphasis used status button
  //   2. form is not this form: hide action bar
  // * status is not done:
  //   1. current user: show action bar
  //   2. not current user: disabled action bar

  const { data: user } = useCurrentUserContext();
  const { userJob } = useFlowContext();
  const { status, result, userId } = userJob;
  const buttonSchema = useFieldSchema();
  const { name } = buttonSchema.parent.toJSON();

  let { children: content } = props;
  if (status) {
    if (!result[name]) {
      content = null;
    }
  } else {
    if (user?.data?.id !== userId) {
      content = null;
    }
  }

  return content;
}

const ManualActionStatusContext = createContext<number | null>(null);
ManualActionStatusContext.displayName = 'ManualActionStatusContext';

function ManualActionStatusProvider({ value, children }) {
  const { userJob, execution } = useFlowContext();
  const button = useField();
  const buttonSchema = useFieldSchema();
  const compile = useCompile();

  useEffect(() => {
    if (execution.status || userJob.status) {
      button.disabled = true;
      button.visible = userJob.status === value && userJob.result._ === buttonSchema.name;
    }
  }, [execution, userJob, value, button, buttonSchema.name]);

  return (
    <ManualActionStatusContext.Provider value={value}>
      {execution.status || userJob.status ? (
        <Button type="primary" disabled>
          {compile(buttonSchema.title)}
        </Button>
      ) : (
        children
      )}
    </ManualActionStatusContext.Provider>
  );
}

function useSubmit() {
  const api = useAPIClient();
  const { setVisible, setSubmitted } = useActionContext();
  const { values, submit } = useForm();
  const field = useField();
  const buttonSchema = useFieldSchema();
  const { service } = useTableBlockContext();
  const { userJob, execution } = useFlowContext();
  const { name: actionKey } = buttonSchema;
  const { name: formKey } = buttonSchema.parent.parent;
  const { assignedValues = {} } = buttonSchema?.['x-action-settings'] ?? {};
  return {
    async run() {
      if (execution.status || userJob.status) {
        return;
      }
      await submit();
      field.data = field.data || {};
      field.data.loading = true;

      await api.resource('users_jobs').submit({
        filterByTk: userJob.id,
        values: {
          result: { [formKey]: { ...values, ...assignedValues.values }, _: actionKey },
        },
      });

      field.data.loading = false;
      setSubmitted(true);
      setVisible(false);
      service?.refresh();
    },
  };
}

function FlowContextProvider(props) {
  const workflowPlugin = usePlugin(WorkflowPlugin);
  const api = useAPIClient();
  const { id } = useCollectionRecordData() || {};
  const [flowContext, setFlowContext] = useState<any>(null);
  const [node, setNode] = useState<any>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    api
      .resource('users_jobs')
      .get?.({
        filterByTk: id,
        appends: ['node', 'job', 'workflow', 'workflow.nodes', 'execution', 'execution.jobs'],
      })
      .then(({ data }) => {
        const { node, workflow: { nodes = [], ...workflow } = {}, execution, ...userJob } = data?.data ?? {};
        linkNodes(nodes);
        setNode(node);
        setFlowContext({
          userJob,
          workflow,
          nodes,
          execution,
        });
        return;
      });
  }, [api, id]);

  const upstreams = useAvailableUpstreams(flowContext?.nodes.find((item) => item.id === node.id));
  const nodeComponents = upstreams.reduce(
    (components, { type }) => Object.assign(components, workflowPlugin.instructions.get(type).components),
    {},
  );

  return node && flowContext ? (
    <FlowContext.Provider value={flowContext}>
      <SchemaComponent
        components={{
          FormBlockProvider,
          DetailsBlockProvider,
          ActionBarProvider,
          ManualActionStatusProvider,
          // @ts-ignore
          ...Array.from(manualFormTypes.getValues()).reduce(
            (result, item: ManualFormType) => Object.assign(result, item.block.components),
            {},
          ),
          ...nodeComponents,
        }}
        scope={{
          useSubmit,
          useFormBlockProps,
          useDetailsBlockProps,
          // @ts-ignore
          ...Array.from(manualFormTypes.getValues()).reduce(
            (result, item: ManualFormType) => Object.assign(result, item.block.scope),
            {},
          ),
        }}
        schema={{
          type: 'void',
          name: 'tabs',
          'x-component': 'Tabs',
          properties: node.config?.schema,
        }}
      />
    </FlowContext.Provider>
  ) : (
    <Spin />
  );
}

function useFormBlockProps() {
  const { userJob, execution } = useFlowContext();
  const recordData = useCollectionRecordData();
  const { data: user } = useCurrentUserContext();
  const { form } = useFormBlockContext();

  const pattern =
    execution.status || userJob.status
      ? recordData
        ? 'readPretty'
        : 'disabled'
      : user?.data?.id !== userJob.userId
        ? 'disabled'
        : 'editable';

  useEffect(() => {
    form?.setPattern(pattern);
  }, [pattern, form]);

  return { form };
}

function useDetailsBlockProps() {
  const { form } = useFormBlockContext();
  return { form };
}

function FooterStatus() {
  const compile = useCompile();
  const { status, updatedAt } = useCollectionRecordData() || {};
  const statusOption = JobStatusOptionsMap[status];
  return status ? (
    <Space>
      <time
        className={css`
          margin-right: 0.5em;
        `}
      >
        {dayjs(updatedAt).format('YYYY-MM-DD HH:mm:ss')}
      </time>
      <Tag icon={statusOption.icon} color={statusOption.color}>
        {compile(statusOption.label)}
      </Tag>
    </Space>
  ) : null;
}

function Drawer() {
  const ctx = useContext(SchemaComponentContext);
  const { id, node, workflow, status } = useCollectionRecordData() || {};

  return (
    <SchemaComponentContext.Provider value={{ ...ctx, reset() {}, designable: false }}>
      <SchemaComponent
        components={{
          FooterStatus,
          FlowContextProvider,
        }}
        schema={{
          type: 'void',
          name: `drawer-${id}-${status}`,
          'x-component': 'Action.Container',
          'x-component-props': {
            className: 'nb-action-popup',
          },
          title: `${workflow?.title} - ${node?.title ?? `#${node?.id}`}`,
          properties: {
            tabs: {
              type: 'void',
              'x-component': 'FlowContextProvider',
            },
            footer: {
              type: 'void',
              'x-component': 'Action.Container.Footer',
              properties: {
                content: {
                  type: 'void',
                  'x-component': 'FooterStatus',
                },
              },
            },
          },
        }}
      />
    </SchemaComponentContext.Provider>
  );
}

function Decorator({ params = {}, children }) {
  const blockProps = {
    collection: 'users_jobs',
    resource: 'users_jobs',
    action: 'list',
    params: {
      pageSize: 20,
      sort: ['-createdAt'],
      ...params,
      appends: ['user', 'node', 'workflow', 'execution.status'],
      except: ['node.config', 'workflow.config', 'workflow.options'],
    },
    rowKey: 'id',
    showIndex: true,
    dragSort: false,
  };

  return (
    <TableBlockProvider name="workflow-todo" {...blockProps}>
      {children}
    </TableBlockProvider>
  );
}

WorkflowTodo.Drawer = Drawer;
WorkflowTodo.Decorator = Decorator;
